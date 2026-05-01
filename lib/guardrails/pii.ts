/**
 * PII detection for the guardrails pipeline.
 *
 * Single source of truth for the PII pattern registry — used by all routes
 * that scan user input or model output:
 *   - `/api/translate` (detect-only via `detectPii` + `logWarn`)
 *   - `/api/summarize` (detect-only via `detectPii` + `logWarn`)
 *   - `/api/tts`       (strict block via `checkInputPii`)
 *
 * Per-route policy (block vs. detect-only) lives at the call site, not
 * inside this module. The summarize route used to keep an inline copy of
 * this registry; that has been deleted in favour of importing `detectPii`
 * from here.
 */

import type { GuardrailResult } from './types'

// ---------------------------------------------------------------------------
// Pattern registry
// ---------------------------------------------------------------------------

export interface PiiMatch {
  /** Short machine-readable identifier, e.g. "ssn", "email". */
  type: string
  /** Human-readable label suitable for error messages. */
  label: string
}

const SENSITIVE_PATTERNS: ReadonlyArray<PiiMatch & { pattern: RegExp }> = [
  {
    type: 'ssn',
    label: 'Social Security Number (SSN)',
    // Matches XXX-XX-XXXX, XXX XX XXXX, or 9 consecutive digits
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
  },
  {
    type: 'credit_card',
    label: 'Credit or Debit Card Number',
    // 16-digit card numbers with optional spaces/dashes between groups of 4
    pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/,
  },
  {
    type: 'phone',
    label: 'Phone Number',
    // US/international formats: (555) 555-5555, +1 555.555.5555, etc.
    pattern: /\b(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/,
  },
  {
    type: 'email',
    label: 'Email Address',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,
  },
  {
    type: 'credential',
    label: 'Password or API Key',
    // "password: abc123", "api_key=xyz", "token: ..."
    pattern:
      /(?:password|passwd|pwd|api[_\s]?key|secret|bearer|token)\s*[:=]\s*\S{4,}/i,
  },
  {
    type: 'bank_account',
    label: 'Bank Account or Routing Number',
    // Explicit account/routing number labels followed by 8-17 digits
    pattern:
      /\b(?:account|routing|acct)[\s_\-]?(?:number|num|no\.?|#)?\s*[:=]?\s*\d{8,17}\b/i,
  },
  {
    type: 'passport',
    label: 'Passport Number',
    // Passport label (passport / pass no / ppt) followed by 1–2 letters + 6–9
    // digits. Must be anchored to an explicit keyword to avoid matching
    // generic alphanumeric codes like "AB1234567" or "US12345678" that show
    // up frequently in legitimate documents (model numbers, order refs,
    // tracking IDs). Mirrors the labelled style used by `bank_account` and
    // `drivers_license`.
    pattern:
      /\b(?:passport|pass(?:port)?\s*no\.?|ppt)\s*(?:number|num|no\.?|#)?\s*[:=]?\s*[A-Z]{1,2}\d{6,9}\b/i,
  },
  {
    type: 'drivers_license',
    label: "Driver's License Number",
    // Label followed by an alphanumeric ID
    pattern:
      /\b(?:driver['s]*\s*licen[sc]e|dl|d\.l\.)\s*(?:number|num|no\.?|#)?\s*[:=]?\s*[A-Z0-9]{5,15}\b/i,
  },
]

// ---------------------------------------------------------------------------
// Core detection function
// ---------------------------------------------------------------------------

/**
 * Scans `text` for sensitive PII patterns.
 *
 * Returns every category detected; each type appears at most once
 * (per-category deduplication). An empty array means no PII was found.
 *
 * Routes that should never block on PII (e.g. `/api/translate`, which
 * exists specifically to help users read documents that contain sensitive
 * data) call this directly and feed the result into `logWarn` for
 * detect-only observability.
 *
 * Routes that should block on PII (e.g. `/api/tts`, where the threat model
 * differs because the synthesized audio reads the data aloud) call
 * `checkInputPii` / `checkOutputPii` instead.
 */
export function detectPii(text: string): PiiMatch[] {
  const found: PiiMatch[] = []
  for (const { type, label, pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      found.push({ type, label })
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// GuardrailResult helpers
// ---------------------------------------------------------------------------

/**
 * Runs PII detection on `text` and returns a `GuardrailResult<string>`.
 *
 * - If no PII is found, returns `{ ok: true, value: text }`.
 * - If PII is detected, returns a structured 422 error with `code: "PII_DETECTED"`.
 *
 * Used by routes that *should* block on PII (currently `/api/tts`). The
 * translate route deliberately does **not** call this — see `detectPii` and
 * the docstring at the top of `app/api/translate/route.ts` for rationale.
 *
 * @param text    - The text to scan (already sanitized is fine; sanitization is a separate layer).
 * @param route   - The API route string, used only in the error `details` (e.g. "/api/tts").
 * @param layer   - Which guardrail layer is calling this (defaults to "input-validation").
 */
export function checkInputPii(
  text: string,
  route: string,
  layer: 'input-validation' | 'output-validation' = 'input-validation'
): GuardrailResult<string> {
  const matches = detectPii(text)
  if (matches.length === 0) {
    return { ok: true, value: text }
  }
  return {
    ok: false,
    status: 422,
    response: {
      error:
        'Submission blocked: the text appears to contain sensitive personal information. Please remove it before proceeding.',
      code: 'PII_DETECTED',
      layer,
      details: {
        route,
        detectedTypes: matches,
      },
    },
  }
}

/**
 * Runs PII detection on processed output text.
 *
 * Identical logic to `checkInputPii` but uses `code: "OUTPUT_PII_DETECTED"`
 * and `layer: "output-validation"` to distinguish it from input-side blocks.
 *
 * Currently unused; retained for routes that may need post-call output
 * gating in the future. The translate route uses `detectPii` + `logWarn`
 * for detect-only observability instead.
 *
 * @param text  - The output text returned by the upstream API.
 * @param route - The API route string (for structured error details).
 */
export function checkOutputPii(
  text: string,
  route: string
): GuardrailResult<string> {
  const matches = detectPii(text)
  if (matches.length === 0) {
    return { ok: true, value: text }
  }
  return {
    ok: false,
    status: 422,
    response: {
      error:
        'The processed output appears to contain sensitive personal information and has been blocked.',
      code: 'OUTPUT_PII_DETECTED',
      layer: 'output-validation',
      details: {
        route,
        detectedTypes: matches,
      },
    },
  }
}
