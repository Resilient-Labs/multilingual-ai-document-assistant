/**
 * Safety endpoint guardrails — input sanitization and validation before the LLM call.
 *
 * Handles NFC normalization, control-char stripping, prompt-injection + Llama 3 marker
 * stripping, and length caps for document text and detected field candidates.
 *
 * Policy blocks (crisis / off-topic) are intentionally excluded: this channel analyzes
 * document content, not user queries.
 */

/** Cap on total analyzed text (fullText or joined blocks). */
export const SAFETY_MAX_TEXT_CHARS = 100_000;

/** Cap on the number of detected field entries forwarded to the model. */
export const SAFETY_MAX_FIELD_CANDIDATES = 500;

const CONTROL_STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Role-override / jailbreak phrases. Case-insensitive. */
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

export type SafetyValidationFailure = {
  status: 400 | 413;
  error: string;
};

export type FieldCandidate = {
  key: string;
  value: string;
};

/**
 * NFC normalize, strip dangerous control characters, trim.
 */
export function sanitizeSafetyPlainText(value: string): string {
  return value.normalize("NFC").replace(CONTROL_STRIP, "").trim();
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

/**
 * Sanitize document text and field candidates before prompt construction.
 *
 * - Applies NFC normalization, control-char stripping, and injection/Llama marker
 *   stripping to `textToAnalyze`.
 * - For each field candidate: sanitizes `key` and `value`, drops entries where either
 *   becomes empty, and caps the list at `SAFETY_MAX_FIELD_CANDIDATES`.
 */
export function sanitizeSafetyInputs({
  textToAnalyze,
  fieldCandidates,
}: {
  textToAnalyze: string;
  fieldCandidates?: FieldCandidate[];
}): { textToAnalyze: string; fieldCandidates: FieldCandidate[] } {
  const safeText = stripInjectionPhrases(sanitizeSafetyPlainText(textToAnalyze));

  const safeFields: FieldCandidate[] = [];
  if (Array.isArray(fieldCandidates)) {
    for (const c of fieldCandidates) {
      if (!c?.key || !c?.value) continue;
      const k = stripInjectionPhrases(sanitizeSafetyPlainText(String(c.key)));
      const v = stripInjectionPhrases(sanitizeSafetyPlainText(String(c.value)));
      if (!k || !v) continue;
      safeFields.push({ key: k, value: v });
      if (safeFields.length >= SAFETY_MAX_FIELD_CANDIDATES) break;
    }
  }

  return { textToAnalyze: safeText, fieldCandidates: safeFields };
}

/**
 * Validate sanitized inputs before the OpenRouter call.
 *
 * Returns a failure descriptor on error, or null when inputs are acceptable.
 */
export function validateSafetyRequestInputs(
  textToAnalyze: string,
  _fieldCandidates?: FieldCandidate[],
): SafetyValidationFailure | null {
  if (textToAnalyze.length === 0) {
    return { status: 400, error: "Document text is empty after sanitization." };
  }
  if (textToAnalyze.length > SAFETY_MAX_TEXT_CHARS) {
    return {
      status: 413,
      error: `Document text exceeds the maximum length of ${SAFETY_MAX_TEXT_CHARS.toLocaleString()} characters.`,
    };
  }
  return null;
}
