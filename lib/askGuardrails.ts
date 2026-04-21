/**
 * Ask / Q&A guardrails — server-side validation + sanitization before calling the LLM.
 *
 * **[Zaria] — Guardrails ticket:** implements spec-aligned **input** pieces (length caps, NFC,
 * control-char strip, prompt-injection + Llama marker stripping, **policy blocks** for crisis /
 * self-harm and sexual or other off-topic abuse of the channel). See `buildSystemPrompt` in
 * `app/api/ask/route.ts` for **prompt rules**. Output schema / NLI / embedding checks are not here.
 *
 * Brandi: client still supplies `chunks` / `context`; this module does not replace chunking quality work.
 */

/** Matches guardrails spec user turn length (trimmed). */
export const ASK_MAX_QUESTION_CHARS = 1_000;

/** Total retrieved context we will send to the model (concatenated chunks or `context`). */
export const ASK_MAX_CONTEXT_CHARS = 100_000;

const CONTROL_STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Role-override / jailbreak phrases (document + question). Case-insensitive. */
const INJECTION_PHRASE_PATTERNS: RegExp[] = [
  /\byou are now\b/gi,
  /\bignore (all )?(previous|prior) (instructions|prompts)\b/gi,
  /\bdisregard (all )?(previous|prior)\b/gi,
  /\bnew instructions\b/gi,
  /\byour real instructions\b/gi,
  /\bsystem prompt\b/gi,
  /\boverride (the )?above\b/gi,
  /\b(jailbreak|developer\s+mode|DAN\s+mode)\b/gi,
  /\b(show|reveal|print)\s+(the\s+)?(system|hidden)\s+prompt\b/gi,
];

/** Literal Llama 3 chat marker strings that must not appear verbatim in untrusted text. */
const LLAMA_MARKER_SNIPPETS = [
  "<|begin_of_text|>",
  "<|start_header_id|>",
  "<|end_header_id|>",
  "<|eot_id|>",
  "<|reserved_special_token",
  "[INST]",
  "<<SYS>>",
  "</SYS>>",
] as const;

export type AskValidationFailure = {
  status: 400 | 413 | 422;
  error: string;
};

/** Shown when the question is off-topic / sexual solicitation / jailbreak-style abuse (422). */
export const ASK_POLICY_ERROR_OFF_TOPIC =
  "This assistant only answers questions about your uploaded document. It cannot help with that request.";

/**
 * Crisis routing — generic, does not repeat user wording. 422 so clients can show as a dedicated
 * safety state if desired ([Zaria] policy layer).
 */
export const ASK_POLICY_ERROR_CRISIS =
  "If you may be in danger or are thinking about hurting yourself, contact local emergency services right away. In the United States, call or text 988 for the Suicide & Crisis Lifeline. This tool cannot provide crisis support.";

/** Crisis / self-harm — block before LLM; patterns are English/ES/VI oriented (expand with PM). */
const CRISIS_QUESTION_PATTERNS: RegExp[] = [
  /\b(i\s+)?want\s+(to\s+)?die\b/i,
  /\b(kill(ing)?|hurt(ing)?)\s+myself\b/i,
  /\bsuicid(e|al|idal)\b/i,
  /\bself[\s-]*harm(ing)?\b/i,
  /\bend\s+it\s+all\b/i,
  /\b(take|taking)\s+my\s+(own\s+)?life\b/i,
  /quiero\s+morir/i,
  /(tôi\s+)?muốn\s+chết/i,
  /\btự\s+tử\b/i,
];

/**
 * Sexual solicitation or channel abuse unrelated to document Q&A — conservative phrases to avoid
 * blocking legitimate policy terms in long questions (e.g. “sex discrimination”).
 */
const SEX_OR_ABUSE_SOLICITATION_PATTERNS: RegExp[] = [
  /\b(i\s+)?want\s+sex\b/i,
  /\b(lets?|let\s+us)\s+have\s+sex\b/i,
  /\bhave\s+sex\s+with\s+me\b/i,
  /\bsend\s+(me\s+)?nudes?\b/i,
  /\b(phone|cyber)\s+sex\b/i,
  /\bsex\s+chat\b/i,
  /quiero\s+sexo\b/i,
  /(tôi\s+)?muốn\s+quan\s*hệ(\s+tình\s*dục)?\b/i,
];

/**
 * Returns a validation failure if the **user question** should not be sent to the model.
 * Runs on already-sanitized text. Does not echo user slurs in `error` strings.
 */
export function validateAskQuestionPolicy(
  question: string,
): AskValidationFailure | null {
  const q = question.trim();
  if (q.length === 0) return null;

  for (const re of CRISIS_QUESTION_PATTERNS) {
    if (re.test(q)) {
      return { status: 422, error: ASK_POLICY_ERROR_CRISIS };
    }
  }

  for (const re of SEX_OR_ABUSE_SOLICITATION_PATTERNS) {
    if (re.test(q)) {
      return { status: 422, error: ASK_POLICY_ERROR_OFF_TOPIC };
    }
  }

  return null;
}

/**
 * NFC normalize, trim, strip dangerous control chars, collapse runs of spaces (not newlines).
 */
export function sanitizeAskPlainText(value: string, forQuestion: boolean): string {
  let s = value.normalize("NFC").replace(CONTROL_STRIP, "");
  if (forQuestion) {
    s = s.trim().replace(/[ \t]{2,}/g, " ");
  } else {
    s = s.trim();
  }
  return s;
}

function stripInjectionPhrases(text: string): string {
  let out = text;
  for (const re of INJECTION_PHRASE_PATTERNS) {
    out = out.replace(re, " ");
  }
  for (const marker of LLAMA_MARKER_SNIPPETS) {
    const esc = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(esc, "gi"), " ");
  }
  return out;
}

/** Sanitize question and document context before prompt construction. */
export function sanitizeAskInputs(question: string, contextText: string): {
  question: string;
  contextText: string;
} {
  const q = stripInjectionPhrases(sanitizeAskPlainText(question, true));
  const ctx = stripInjectionPhrases(sanitizeAskPlainText(contextText, false));
  return { question: q, contextText: ctx };
}

export function validateAskRequestInputs(
  question: string,
  contextText: string,
): AskValidationFailure | null {
  const policy = validateAskQuestionPolicy(question);
  if (policy) return policy;

  if (question.length === 0) {
    return { status: 400, error: "Question is empty after sanitization." };
  }
  if (question.length > ASK_MAX_QUESTION_CHARS) {
    return {
      status: 413,
      error: `Question exceeds the maximum length of ${ASK_MAX_QUESTION_CHARS.toLocaleString()} characters.`,
    };
  }
  if (contextText.length > ASK_MAX_CONTEXT_CHARS) {
    return {
      status: 413,
      error: `Document context exceeds the maximum length of ${ASK_MAX_CONTEXT_CHARS.toLocaleString()} characters. Try a shorter selection or fewer chunks.`,
    };
  }
  return null;
}
