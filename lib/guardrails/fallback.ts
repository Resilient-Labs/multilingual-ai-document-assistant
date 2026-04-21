/**
 * Graceful degradation responses for the guardrails pipeline (Layer 5).
 *
 * These helpers produce structured `GuardrailResult` failures that are
 * returned to the client when an upstream service is unavailable or when
 * an unexpected error escapes all other layers.  The original input text is
 * never echoed back verbatim in these responses — only safe metadata (lengths,
 * service names) is included so the client can reconstruct user-facing copy
 * without leaking data into logs or error payloads.
 *
 * Usage
 * ─────
 *   // Translate route — upstream call failed or circuit is OPEN
 *   return NextResponse.json(
 *     translateFallback({ inputLength: text.length }).response,
 *     { status: translateFallback({ inputLength: text.length }).status }
 *   )
 *
 *   // Or using the helper directly:
 *   const fb = translateFallback({ inputLength: text.length })
 *   return NextResponse.json(fb.response, { status: fb.status })
 */

import type { GuardrailResult, GuardrailErrorCode } from './types'

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

/**
 * Builds a `GuardrailResult` failure for Layer 5 with a consistent shape.
 * All public fallback functions delegate to this.
 */
function makeFallback(
  error: string,
  code: GuardrailErrorCode,
  status: number,
  details?: Record<string, unknown>
): GuardrailResult<never> {
  return {
    ok: false,
    status,
    response: {
      error,
      code,
      layer: 'fallback',
      ...(details !== undefined && { details }),
    },
  }
}

// ---------------------------------------------------------------------------
// Options types
// ---------------------------------------------------------------------------

export interface TranslateFallbackOptions {
  /**
   * Character length of the original input.
   * Included in `details` so the client knows the request was received and
   * can preserve the text in the UI while surfacing the error.
   */
  inputLength: number
  /**
   * Optional hint about why the service is unavailable.
   * Must not contain raw user text.
   */
  reason?: string
}

export interface TtsFallbackOptions {
  /**
   * Character length of the TTS input text.
   * Included in `details` for client-side state preservation.
   */
  inputLength: number
  /** Target language code that was requested (safe to log). */
  targetLang?: string
  /**
   * Optional hint about why the service is unavailable.
   * Must not contain raw user text.
   */
  reason?: string
}

export interface InternalErrorFallbackOptions {
  /** The route path where the error occurred (e.g. "/api/translate"). */
  route: string
  /**
   * A safe, non-user-data description of the error for monitoring.
   * Must not contain raw user text or stack traces.
   */
  reason?: string
}

// ---------------------------------------------------------------------------
// Translate fallback (DeepL unavailable)
// ---------------------------------------------------------------------------

/**
 * Returns a 503 fallback for the `/api/translate` route.
 *
 * Used when:
 * - The DeepL circuit breaker is OPEN
 * - The DeepL API call fails and no retry is possible
 * - An unexpected error escapes lower layers
 *
 * The `inputLength` is forwarded so the client can preserve the user's text
 * in the UI and display a retry prompt without losing their work.
 */
export function translateFallback(
  options: TranslateFallbackOptions
): GuardrailResult<never> {
  const { inputLength, reason } = options
  return makeFallback(
    'The translation service is temporarily unavailable. Your text has been preserved — please try again in a moment.',
    'SERVICE_UNAVAILABLE',
    503,
    {
      service: 'deepl',
      inputLength,
      ...(reason !== undefined && { reason }),
    }
  )
}

// ---------------------------------------------------------------------------
// TTS fallback (HF Space unavailable)
// ---------------------------------------------------------------------------

/**
 * Returns a 503 fallback for the `/api/tts` route.
 *
 * Used when:
 * - The HF Space TTS circuit breaker is OPEN
 * - The synthesizeSpeech call fails or returns an invalid audio payload
 * - An unexpected error escapes lower layers
 */
export function ttsFallback(
  options: TtsFallbackOptions
): GuardrailResult<never> {
  const { inputLength, targetLang, reason } = options
  return makeFallback(
    'The text-to-speech service is temporarily unavailable. Please try again in a moment.',
    'SERVICE_UNAVAILABLE',
    503,
    {
      service: 'hf-space-tts',
      inputLength,
      ...(targetLang !== undefined && { targetLang }),
      ...(reason !== undefined && { reason }),
    }
  )
}

// ---------------------------------------------------------------------------
// Generic internal-error fallback
// ---------------------------------------------------------------------------

/**
 * Returns a 500 fallback for unexpected errors that escape all other layers.
 *
 * This is the last-resort handler.  It deliberately provides minimal detail
 * to the client to avoid leaking implementation internals, while the `reason`
 * is safe to record in structured logs.
 */
export function internalErrorFallback(
  options: InternalErrorFallbackOptions
): GuardrailResult<never> {
  const { route, reason } = options
  return makeFallback(
    'An unexpected error occurred. Please try again.',
    'INTERNAL_ERROR',
    500,
    {
      route,
      ...(reason !== undefined && { reason }),
    }
  )
}
