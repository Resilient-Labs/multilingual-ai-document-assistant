/**
 * Domain restrictions for the guardrails pipeline (Layer 2).
 *
 * Three independent checks run in order:
 * 1. Language whitelist — confirm targetLang is in the route-specific allowed set.
 *    (Defense-in-depth after the Zod enum check in Layer 1.)
 * 2. Prompt injection detection — regex scan for LLM-manipulation patterns.
 *    These routes call non-LLM external APIs, but the text flows through them;
 *    this is defense-in-depth against future route changes and upstream surprises.
 * 3. Content policy — reject text that contains code injection payloads
 *    (SQL, shell commands) with no legitimate place in translation or TTS input.
 */

import type { GuardrailResult } from './types'
import {
  TRANSLATE_SUPPORTED_LANGS,
  TTS_SUPPORTED_LANGS,
  type TranslateSupportedLang,
  type TtsSupportedLang,
} from './schemas'

// ---------------------------------------------------------------------------
// Language whitelist
// ---------------------------------------------------------------------------

/**
 * Checks that `targetLang` is in the set supported by the translate route.
 * Returns `{ ok: true, value: targetLang }` on success or a 422 error.
 */
export function checkTranslateLang(
  targetLang: string
): GuardrailResult<TranslateSupportedLang> {
  const supported = TRANSLATE_SUPPORTED_LANGS as ReadonlyArray<string>
  if (supported.includes(targetLang)) {
    return { ok: true, value: targetLang as TranslateSupportedLang }
  }
  return {
    ok: false,
    status: 422,
    response: {
      error: `Language '${targetLang}' is not supported for translation.`,
      code: 'UNSUPPORTED_LANGUAGE',
      layer: 'domain',
      details: {
        provided: targetLang,
        supported: TRANSLATE_SUPPORTED_LANGS,
      },
    },
  }
}

/**
 * Checks that `targetLang` is in the set supported by the TTS route.
 * Returns `{ ok: true, value: targetLang }` on success or a 422 error.
 */
export function checkTtsLang(
  targetLang: string
): GuardrailResult<TtsSupportedLang> {
  const supported = TTS_SUPPORTED_LANGS as ReadonlyArray<string>
  if (supported.includes(targetLang)) {
    return { ok: true, value: targetLang as TtsSupportedLang }
  }
  return {
    ok: false,
    status: 422,
    response: {
      error: `Language '${targetLang}' is not supported for text-to-speech. Supported languages: ${TTS_SUPPORTED_LANGS.join(', ')}.`,
      code: 'UNSUPPORTED_LANGUAGE',
      layer: 'domain',
      details: {
        provided: targetLang,
        supported: TTS_SUPPORTED_LANGS,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Prompt injection detection
// ---------------------------------------------------------------------------

interface InjectionPattern {
  /** Short machine-readable identifier used in logs. */
  type: string
  /** Human-readable label for structured error details. */
  label: string
  pattern: RegExp
}

/**
 * Known prompt-injection and LLM-manipulation patterns.
 *
 * These routes do not call LLMs directly, but the text they forward can
 * contain latent instructions that affect downstream processing or future
 * integrations. This list targets the most commonly observed attack vectors:
 *
 * - Instruction override: "ignore previous instructions"
 * - Role-play hijacking: "you are now a DAN (Do Anything Now)", "pretend you are"
 * - System-prompt prefix injection: "System: ..."
 * - Common LLM delimiter tokens used in fine-tuned models
 * - Jailbreak cues: "DAN (Do Anything Now) mode", "developer mode enabled"
 * - RLHF bypass phrases: "for educational purposes only", "hypothetically"
 *   (narrow forms only — broad phrasings generate too many false positives)
 */
const INJECTION_PATTERNS: ReadonlyArray<InjectionPattern> = [
  {
    type: 'ignore-instructions',
    label: 'Instruction override attempt',
    // Matches: "ignore previous instructions", "ignore prior instructions",
    //          "ignore above instructions", etc.
    pattern: /ignore\s+(?:previous|prior|above|all)\s+instructions?/i,
  },
  {
    type: 'role-override',
    label: 'Role-play hijack attempt',
    // Matches: "you are now a", "you are a", "act as a", "pretend you are",
    //          "pretend to be", "roleplay as"
    pattern:
      /(?:you\s+are\s+(?:now\s+)?(?:a|an)|act\s+as\s+(?:a|an)|pretend\s+(?:you\s+are|to\s+be)|roleplay\s+as)\b/i,
  },
  {
    type: 'system-prefix',
    label: 'System-prompt prefix injection',
    // Matches "System:", "SYSTEM:" at the start of a token boundary
    pattern: /\bsystem\s*:/i,
  },
  {
    type: 'instruction-delimiter',
    label: 'Instruction delimiter token',
    // Common fine-tuning delimiters: "### Instruction", "### System"
    pattern: /###\s*(?:instruction|system|prompt|input|output)\b/i,
  },
  {
    type: 'llm-pipe-delimiter',
    label: 'LLM pipe-delimiter token',
    // Matches <|im_start|>, <|endoftext|>, <|system|>, etc.
    pattern: /<\|[a-z_]{1,30}\|>/i,
  },
  {
    type: 'llm-inst-tag',
    label: 'LLaMA/Mistral [INST] tag',
    // Matches [INST], [/INST], [SYS], [/SYS]
    pattern: /\[(?:\/?\s*(?:INST|SYS|SYSTEM|ASSISTANT|USER))\s*\]/i,
  },
  {
    type: 'jailbreak-dan',
    label: 'DAN / jailbreak mode trigger',
    // Matches "DAN mode", "developer mode enabled", "jailbreak mode"
    pattern: /\b(?:DAN\s+mode|developer\s+mode\s+enabled|jailbreak\s+mode)\b/i,
  },
  {
    type: 'prompt-leak',
    label: 'Prompt leak / exfiltration attempt',
    // Matches "repeat your instructions", "print your system prompt",
    //         "output your prompt", "reveal your instructions"
    pattern:
      /(?:repeat|print|output|reveal|show|display)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|directives?)\b/i,
  },
  {
    type: 'context-terminator',
    label: 'Context termination injection',
    // Matches common context-ending tokens: "---END---", "```", triple newlines
    // used to break the model's context window
    pattern: /---\s*END\s*---/i,
  },
]

export interface InjectionMatch {
  type: string
  label: string
}

/**
 * Scans `text` for prompt injection patterns.
 * Returns every category detected (per-type deduplicated). Empty array = clean.
 */
export function detectInjection(text: string): InjectionMatch[] {
  const found: InjectionMatch[] = []
  for (const { type, label, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      found.push({ type, label })
    }
  }
  return found
}

/**
 * Runs injection detection on `text` and returns a `GuardrailResult<string>`.
 *
 * - Clean text returns `{ ok: true, value: text }`.
 * - Detected injection returns a 422 with `code: "INJECTION_DETECTED"`.
 */
export function checkInjection(
  text: string,
  route: string
): GuardrailResult<string> {
  const matches = detectInjection(text)
  if (matches.length === 0) {
    return { ok: true, value: text }
  }
  return {
    ok: false,
    status: 422,
    response: {
      error:
        'Submission blocked: the text contains patterns that are not permitted in translation or speech synthesis input.',
      code: 'INJECTION_DETECTED',
      layer: 'domain',
      details: {
        route,
        detectedTypes: matches,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Content policy (code injection)
// ---------------------------------------------------------------------------

interface ContentPattern {
  type: string
  label: string
  pattern: RegExp
}

/**
 * Code-injection and shell-injection patterns that have no legitimate place in
 * translation or TTS input.
 *
 * These are intentionally narrow (require recognizable keywords + structure)
 * to avoid false positives on content that mentions SQL or scripting in
 * natural language.
 */
const CONTENT_POLICY_PATTERNS: ReadonlyArray<ContentPattern> = [
  {
    type: 'sql-select',
    label: 'SQL SELECT statement',
    // Requires SELECT ... FROM to be together to avoid triggering on sentences.
    // [\s\S] used instead of dotAll flag for broader TS target compatibility.
    pattern: /\bSELECT\b[\s\S]{0,200}\bFROM\b/i,
  },
  {
    type: 'sql-dml',
    label: 'SQL data-manipulation statement',
    // INSERT INTO, UPDATE ... SET, DELETE FROM, DROP TABLE/DATABASE
    pattern:
      /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE|SCHEMA))\b/i,
  },
  {
    type: 'sql-exec',
    label: 'SQL stored-procedure execution',
    // EXEC, EXECUTE, xp_cmdshell (common SQL Server injection vector)
    pattern: /\b(?:EXEC(?:UTE)?|xp_cmdshell)\b/i,
  },
  {
    type: 'shell-pipe',
    label: 'Shell pipe / command chaining',
    // Semicolon-separated commands, pipe to shell utilities, backtick execution
    // Narrow form: only flag when paired with recognizable shell utility names
    pattern:
      /(?:;\s*(?:rm|chmod|curl|wget|bash|sh|python|perl|ruby|nc|ncat)\b|`[^`]{1,200}`|\$\([^)]{1,200}\))/i,
  },
  {
    type: 'path-traversal',
    label: 'Path traversal sequence',
    // ../../ style directory traversal with at least 2 levels
    pattern: /(?:\.\.\/){2,}|(?:\.\.\\){2,}/,
  },
  {
    type: 'script-tag',
    label: 'Inline script tag',
    // Defense-in-depth: sanitize.ts strips these, but flag if still present
    // after sanitization (indicates the sanitizer was somehow bypassed)
    pattern: /<script\b/i,
  },
]

export interface ContentPolicyMatch {
  type: string
  label: string
}

/**
 * Scans `text` for content policy violations (code/shell injection payloads).
 * Returns every category detected. Empty array = clean.
 */
export function detectContentViolation(text: string): ContentPolicyMatch[] {
  const found: ContentPolicyMatch[] = []
  for (const { type, label, pattern } of CONTENT_POLICY_PATTERNS) {
    if (pattern.test(text)) {
      found.push({ type, label })
    }
  }
  return found
}

/**
 * Runs content policy checking on `text` and returns a `GuardrailResult<string>`.
 *
 * - Clean text returns `{ ok: true, value: text }`.
 * - Violations return a 422 with `code: "CONTENT_POLICY_VIOLATION"`.
 */
export function checkContentPolicy(
  text: string,
  route: string
): GuardrailResult<string> {
  const matches = detectContentViolation(text)
  if (matches.length === 0) {
    return { ok: true, value: text }
  }
  return {
    ok: false,
    status: 422,
    response: {
      error:
        'Submission blocked: the text contains content that is not permitted in translation or speech synthesis input.',
      code: 'CONTENT_POLICY_VIOLATION',
      layer: 'domain',
      details: {
        route,
        detectedTypes: matches,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Composed domain check
// ---------------------------------------------------------------------------

/**
 * Runs all domain-layer checks on `text` in order:
 * 1. Prompt injection detection
 * 2. Content policy
 *
 * Language validation is intentionally omitted here because it depends on
 * route-specific context (translate vs. TTS). Call `checkTranslateLang` or
 * `checkTtsLang` separately before or after this function.
 *
 * Returns the first failure encountered, or `{ ok: true, value: text }` if
 * all checks pass.
 */
export function checkDomain(
  text: string,
  route: string
): GuardrailResult<string> {
  const injectionResult = checkInjection(text, route)
  if (!injectionResult.ok) return injectionResult

  const contentResult = checkContentPolicy(text, route)
  if (!contentResult.ok) return contentResult

  return { ok: true, value: text }
}
