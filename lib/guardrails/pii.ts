/**
 * PII detection for the guardrails pipeline.
 *
 * Single source of truth for the PII pattern registry — used by all routes
 * that scan user input. Every active route currently uses the same
 * detect-only policy because this app exists to help users understand
 * documents they already have, which routinely contain sensitive data
 * (immigration paperwork, court filings, benefits letters, medical bills):
 *
 *   - `/api/translate` (detect-only via `detectPii` + `logWarn`)
 *   - `/api/summarize` (detect-only via `detectPii` + `logWarn`)
 *   - `/api/tts`       (detect-only via `detectPii` + `logWarn`)
 *
 * `checkInputPii` / `checkOutputPii` remain exported as primitives for any
 * future deployment that does need a strict block (e.g. a third-party
 * embedding of this app where the threat model is different), but no
 * production route currently uses them. Per-route policy lives at the call
 * site, not inside this module.
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
 * All production routes (`/api/translate`, `/api/summarize`, `/api/tts`)
 * currently call this directly and feed the result into `logWarn` for
 * detect-only observability. `checkInputPii` / `checkOutputPii` remain
 * available for future deployments that need to fail-closed instead.
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
 * **Currently has no production callers** — every active route uses
 * `detectPii` + `logWarn` for detect-only observability. Retained as a
 * primitive for any future deployment that needs to fail-closed (e.g. a
 * third-party embedding of this app where the user is not the document
 * owner).
 *
 * @param text    - The text to scan (already sanitized is fine; sanitization is a separate layer).
 * @param route   - The API route string, used only in the error `details`.
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
