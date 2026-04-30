/**
 * Public API for the lib/guardrails module.
 *
 * Two things live here:
 *
 * 1. Re-exports — every public symbol from every submodule is re-exported so
 *    that route handlers import from a single, stable path:
 *
 *      import { TranslateInputSchema, guardrailLog, getCircuitBreaker, … }
 *        from '@/lib/guardrails'
 *
 * 2. Pipeline helpers — `applyGuardrails` (the generic sequential runner) and
 *    the two typed composite helpers, `runTranslateGuardrails` and
 *    `runTtsGuardrails`, that compose Layers 1–3 and the circuit-breaker
 *    pre-flight check into a single function call for each route.
 *
 *    Route handler workflow:
 *
 *      // ── Pre-call (L1–L3 + circuit breaker) ─────────────────────────────
 *      const pre = runTranslateGuardrails(rawBody, '/api/translate')
 *      if (!pre.ok) return NextResponse.json(pre.response, { status: pre.status })
 *      const { sanitizedText, hardenedBody, circuitBreaker } = pre.value
 *
 *      // ── Upstream call ────────────────────────────────────────────────────
 *      let rawApiResponse: unknown
 *      try {
 *        rawApiResponse = await callDeepL(hardenedBody)
 *        circuitBreaker.onSuccess()
 *      } catch (err) {
 *        circuitBreaker.onFailure()
 *        // L5: graceful degradation — upstream call failed or timed out
 *        const fb = translateFallback({ inputLength: sanitizedText.length })
 *        return NextResponse.json(fb.response, { status: fb.status })
 *      }
 *
 *      // ── Output validation (L4) ───────────────────────────────────────────
 *      const out = validateTranslateOutput(rawApiResponse, '/api/translate')
 *      // L5: graceful degradation — upstream returned an invalid/unexpected response
 *      if (!out.ok) return NextResponse.json(out.response, { status: out.status })
 *
 *      return NextResponse.json({ translatedText: out.value.translatedText })
 */

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export * from './types'
export * from './schemas'
export * from './sanitize'
export * from './pii'
export * from './domain'
export * from './request-hardening'
export * from './output-validation'
export * from './circuit-breaker'
export * from './fallback'
export * from './logger'

// ---------------------------------------------------------------------------
// applyGuardrails — generic sequential pipeline runner
// ---------------------------------------------------------------------------

import type { GuardrailResult } from './types'

/**
 * Runs a sequence of guardrail checks against a single value, short-circuiting
 * on the first failure.  Each step receives the output value of the previous
 * step.
 *
 * This is the core pipeline primitive for homogeneous step chains (e.g. a
 * series of `string → GuardrailResult<string>` domain checks).  Route handlers
 * use the typed convenience wrappers `runTranslateGuardrails` and
 * `runTtsGuardrails` rather than calling this directly.
 *
 * @param initial  The starting value (already known to be valid at this point).
 * @param steps    Ordered array of check functions to apply in sequence.
 *
 * @example
 *   const result = applyGuardrails(text, [
 *     (t) => checkInjection(t, route),
 *     (t) => checkContentPolicy(t, route),
 *   ])
 */
export function applyGuardrails<T>(
  initial: T,
  steps: ReadonlyArray<(value: T) => GuardrailResult<T>>
): GuardrailResult<T> {
  let current: T = initial
  for (const step of steps) {
    const result = step(current)
    if (!result.ok) return result
    current = result.value
  }
  return { ok: true, value: current }
}

// ---------------------------------------------------------------------------
// Route-specific composite pipeline helpers (Layers 1–3 + circuit breaker)
// ---------------------------------------------------------------------------

import {
  TranslateInputSchema,
  TtsInputSchema,
  type TranslateSupportedLang,
  type TtsSupportedLang,
} from './schemas'
import { sanitizeText } from './sanitize'
import { checkInputPii } from './pii'
import { checkTranslateLang, checkTtsLang, checkDomain } from './domain'
import { hardenTranslateRequest, hardenTtsRequest, type DeepLRequestBody, type HfSpaceRequestBody } from './request-hardening'
import { getCircuitBreaker, type CircuitBreaker } from './circuit-breaker'
import { guardrailLog, logPass, logReject, logSanitize } from './logger'
import type { Gender } from '@/lib/tts/types'

// ── Translate ────────────────────────────────────────────────────────────────

/**
 * The value produced by `runTranslateGuardrails` on success.
 * Contains everything the route handler needs before the upstream call.
 */
export interface TranslateGuardrailsOutput {
  /** The translated-input text after sanitization (safe to forward to DeepL). */
  sanitizedText: string
  /** Validated, whitelisted target language code. */
  targetLang: TranslateSupportedLang
  /** Validated and hardened DeepL request body (only allowed keys, source_lang forced). */
  hardenedBody: DeepLRequestBody
  /**
   * The live circuit-breaker instance for DeepL.
   * Route handler MUST call `circuitBreaker.onSuccess()` or
   * `circuitBreaker.onFailure()` after the upstream call completes.
   */
  circuitBreaker: CircuitBreaker
}

/**
 * Runs all pre-call guardrail layers (L1–L3) for the `/api/translate` route,
 * including the circuit-breaker preflight check.
 *
 * Layers applied in order:
 * 1. Zod schema validation (text length, targetLang enum)
 * 2. Text sanitization (HTML strip, zero-width removal, Unicode NFC, whitespace)
 * 3. Input PII detection
 * 4. Domain checks (language whitelist, prompt injection, content policy)
 * 5. Request hardening (source_lang forced to EN, DEEPL_LANG_MAP mapping)
 * 6. Circuit breaker preflight (short-circuit if DeepL is OPEN)
 *
 * Returns `{ ok: true, value: TranslateGuardrailsOutput }` on success, or a
 * structured `{ ok: false, response, status }` failure at the first rejection.
 *
 * @param rawBody  The raw parsed JSON body from the incoming request.
 * @param route    The API route path for logging (e.g. `"/api/translate"`).
 */
export function runTranslateGuardrails(
  rawBody: unknown,
  route: string
): GuardrailResult<TranslateGuardrailsOutput> {
  // ── Layer 1: Zod schema validation ──────────────────────────────────────
  const parsed = TranslateInputSchema.safeParse(rawBody)
  if (!parsed.success) {
    const issues = parsed.error.issues
    const firstIssue = issues[0]
    const code =
      firstIssue?.message?.toLowerCase().includes('too_big') ||
      firstIssue?.message?.toLowerCase().includes('exceed')
        ? 'TEXT_TOO_LONG'
        : firstIssue?.path?.length === 0 || firstIssue?.code === 'invalid_type'
          ? 'MISSING_REQUIRED_FIELD'
          : 'INVALID_INPUT'

    logReject(route, 'input-validation', 'Zod schema validation failed', {
      issueCount: issues.length,
      firstPath: firstIssue?.path?.join('.') ?? '(unknown)',
    })

    return {
      ok: false,
      status: 422,
      response: {
        error: firstIssue?.message ?? 'Invalid request body.',
        code,
        layer: 'input-validation',
        details: { issues: issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      },
    }
  }

  const { text: rawText, targetLang } = parsed.data

  // ── Layer 1: Text sanitization ────────────────────────────────────────────
  const { sanitized: sanitizedText, wasModified } = sanitizeText(rawText)
  if (wasModified) {
    logSanitize(route, 'Input text was sanitized (HTML/zero-width/whitespace)', {
      originalLength: rawText.length,
      sanitizedLength: sanitizedText.length,
    })
  }

  if (sanitizedText.trim().length === 0) {
    logReject(route, 'input-validation', 'Text is empty after sanitization', {
      originalLength: rawText.length,
    })
    return {
      ok: false,
      status: 422,
      response: {
        error: 'text must not be empty',
        code: 'INVALID_INPUT',
        layer: 'input-validation',
        details: { path: 'text', reason: 'empty_after_sanitize' },
      },
    }
  }

  // ── Layer 1: Input PII detection ──────────────────────────────────────────
  const piiResult = checkInputPii(sanitizedText, route, 'input-validation')
  if (!piiResult.ok) {
    logReject(route, 'input-validation', 'PII detected in input text', {
      textLength: sanitizedText.length,
    })
    return piiResult
  }

  // ── Layer 2: Domain checks (injection + content policy) ───────────────────
  const domainResult = checkDomain(sanitizedText, route)
  if (!domainResult.ok) {
    logReject(route, 'domain', domainResult.response.error, {
      code: domainResult.response.code,
      textLength: sanitizedText.length,
    })
    return domainResult
  }

  // ── Layer 2: Language whitelist ───────────────────────────────────────────
  const langResult = checkTranslateLang(targetLang)
  if (!langResult.ok) {
    logReject(route, 'domain', 'Unsupported target language', { targetLang })
    return langResult
  }

  // ── Layer 3: Request hardening ────────────────────────────────────────────
  const hardenResult = hardenTranslateRequest(sanitizedText, langResult.value)
  if (!hardenResult.ok) {
    logReject(route, 'request-hardening', hardenResult.response.error, {
      textLength: sanitizedText.length,
      targetLang,
    })
    return hardenResult
  }

  // ── Layer 5 preflight: Circuit breaker ────────────────────────────────────
  const circuitBreaker = getCircuitBreaker('deepl')
  const cbResult = circuitBreaker.before()
  if (!cbResult.ok) {
    guardrailLog('error', {
      route,
      layer: 'fallback',
      action: 'circuit-open',
      reason: 'DeepL circuit breaker is OPEN — request short-circuited',
      meta: { ...circuitBreaker.snapshot() },
    })
    return cbResult
  }

  logPass(route, 'input-validation', 'All pre-call guardrails passed', {
    textLength: sanitizedText.length,
    targetLang: langResult.value,
  })

  return {
    ok: true,
    value: {
      sanitizedText,
      targetLang: langResult.value,
      hardenedBody: hardenResult.value,
      circuitBreaker,
    },
  }
}

// ── TTS ──────────────────────────────────────────────────────────────────────

/**
 * The value produced by `runTtsGuardrails` on success.
 * Contains everything the route handler needs before the upstream call.
 */
export interface TtsGuardrailsOutput {
  /** The input text after sanitization (safe to forward to HF Space). */
  sanitizedText: string
  /** Validated, TTS-supported target language code. */
  targetLang: TtsSupportedLang
  /** Validated gender selection. */
  gender: Gender
  /** Validated and hardened HF Space request body (only allowed keys, speaker_idx resolved). */
  hardenedBody: HfSpaceRequestBody
  /**
   * The live circuit-breaker instance for HF Space TTS.
   * Route handler MUST call `circuitBreaker.onSuccess()` or
   * `circuitBreaker.onFailure()` after the upstream call completes.
   */
  circuitBreaker: CircuitBreaker
}

/**
 * Runs all pre-call guardrail layers (L1–L3) for the `/api/tts` route,
 * including the circuit-breaker preflight check.
 *
 * Layers applied in order:
 * 1. Zod schema validation (text length, targetLang TTS enum, gender enum)
 * 2. Text sanitization (HTML strip, zero-width removal, Unicode NFC, whitespace)
 * 3. Input PII detection
 * 4. Domain checks (language whitelist, prompt injection, content policy)
 * 5. Request hardening (language derived from validated targetLang, speaker_idx
 *    resolved from env vars and validated against safe pattern)
 * 6. Circuit breaker preflight (short-circuit if HF Space TTS is OPEN)
 *
 * Returns `{ ok: true, value: TtsGuardrailsOutput }` on success, or a
 * structured `{ ok: false, response, status }` failure at the first rejection.
 *
 * @param rawBody  The raw parsed JSON body from the incoming request.
 * @param route    The API route path for logging (e.g. `"/api/tts"`).
 */
export function runTtsGuardrails(
  rawBody: unknown,
  route: string
): GuardrailResult<TtsGuardrailsOutput> {
  // ── Layer 1: Zod schema validation ──────────────────────────────────────
  const parsed = TtsInputSchema.safeParse(rawBody)
  if (!parsed.success) {
    const issues = parsed.error.issues
    const firstIssue = issues[0]
    const code =
      firstIssue?.message?.toLowerCase().includes('too_big') ||
      firstIssue?.message?.toLowerCase().includes('exceed')
        ? 'TEXT_TOO_LONG'
        : firstIssue?.path?.length === 0 || firstIssue?.code === 'invalid_type'
          ? 'MISSING_REQUIRED_FIELD'
          : 'INVALID_INPUT'

    logReject(route, 'input-validation', 'Zod schema validation failed', {
      issueCount: issues.length,
      firstPath: firstIssue?.path?.join('.') ?? '(unknown)',
    })

    return {
      ok: false,
      status: 422,
      response: {
        error: firstIssue?.message ?? 'Invalid request body.',
        code,
        layer: 'input-validation',
        details: { issues: issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      },
    }
  }

  const { text: rawText, targetLang, gender } = parsed.data

  // ── Layer 1: Text sanitization ────────────────────────────────────────────
  const { sanitized: sanitizedText, wasModified } = sanitizeText(rawText)
  if (wasModified) {
    logSanitize(route, 'Input text was sanitized (HTML/zero-width/whitespace)', {
      originalLength: rawText.length,
      sanitizedLength: sanitizedText.length,
    })
  }

  // ── Layer 1: Input PII detection ──────────────────────────────────────────
  const piiResult = checkInputPii(sanitizedText, route, 'input-validation')
  if (!piiResult.ok) {
    logReject(route, 'input-validation', 'PII detected in input text', {
      textLength: sanitizedText.length,
    })
    return piiResult
  }

  // ── Layer 2: TTS language whitelist ──────────────────────────────────────
  const langResult = checkTtsLang(targetLang)
  if (!langResult.ok) {
    logReject(route, 'domain', 'Unsupported TTS target language', { targetLang })
    return langResult
  }

  // ── Layer 2: Domain checks (injection + content policy) ───────────────────
  const domainResult = checkDomain(sanitizedText, route)
  if (!domainResult.ok) {
    logReject(route, 'domain', domainResult.response.error, {
      code: domainResult.response.code,
      textLength: sanitizedText.length,
    })
    return domainResult
  }

  // ── Layer 3: Request hardening ────────────────────────────────────────────
  const hardenResult = hardenTtsRequest(sanitizedText, langResult.value, gender as Gender)
  if (!hardenResult.ok) {
    logReject(route, 'request-hardening', hardenResult.response.error, {
      textLength: sanitizedText.length,
      targetLang,
      gender,
    })
    return hardenResult
  }

  // ── Layer 5 preflight: Circuit breaker ────────────────────────────────────
  const circuitBreaker = getCircuitBreaker('hf-space-tts')
  const cbResult = circuitBreaker.before()
  if (!cbResult.ok) {
    guardrailLog('error', {
      route,
      layer: 'fallback',
      action: 'circuit-open',
      reason: 'HF Space TTS circuit breaker is OPEN — request short-circuited',
      meta: { ...circuitBreaker.snapshot() },
    })
    return cbResult
  }

  logPass(route, 'input-validation', 'All pre-call guardrails passed', {
    textLength: sanitizedText.length,
    targetLang: langResult.value,
    gender,
  })

  return {
    ok: true,
    value: {
      sanitizedText,
      targetLang: langResult.value,
      gender: gender as Gender,
      hardenedBody: hardenResult.value,
      circuitBreaker,
    },
  }
}
