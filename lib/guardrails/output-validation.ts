/**
 * Output validation for the guardrails pipeline (Layer 4).
 *
 * Two categories of checks:
 *
 * Translate (DeepL)
 * - Validate the response body matches the expected DeepL schema.
 * - Enforce non-empty translated text.
 * - Confidence check: warn when detected_source_language is not "EN" (the
 *   user may have sent non-English text despite the product requirement).
 * - PII re-detection: scan the translated output for PII that wasn't in the
 *   input — e.g. PII introduced by the translation model itself.
 *
 * TTS (HF Space)
 * - Validate the response Content-Type is an accepted audio MIME type.
 * - Validate the audio buffer is within reasonable size bounds (non-empty,
 *   not suspiciously oversized).
 */

import type { GuardrailResult } from './types'
import { checkOutputPii } from './pii'

// ---------------------------------------------------------------------------
// Translate — DeepL response validation
// ---------------------------------------------------------------------------

/**
 * Shape of a single translation item in a DeepL v2 response.
 */
export interface DeepLTranslation {
  text: string
  detected_source_language: string
}

/**
 * Top-level shape of a DeepL v2 /translate response.
 */
export interface DeepLResponseBody {
  translations: DeepLTranslation[]
}

/**
 * Result returned from `validateTranslateOutput` on success.
 * Contains the translated text and the detected source language.
 */
export interface ValidatedTranslateOutput {
  translatedText: string
  detectedSourceLanguage: string
  /** True when detected_source_language is not "EN"; callers may log a warning. */
  sourceLangMismatch: boolean
}

/**
 * Validates the raw JSON response from DeepL.
 *
 * Checks performed (in order):
 * 1. Response conforms to the expected `{ translations: [{ text, detected_source_language }] }` shape.
 * 2. Translated text is non-empty.
 * 3. Confidence: detected_source_language matches "EN" (logs a flag when it doesn't).
 * 4. PII re-detection on the translated output text.
 *
 * @param raw   - Parsed JSON body from the DeepL API response.
 * @param route - API route path for structured error details (e.g. "/api/translate").
 */
export function validateTranslateOutput(
  raw: unknown,
  route: string
): GuardrailResult<ValidatedTranslateOutput> {
  // --- Schema validation ---
  if (!isDeepLResponseBody(raw)) {
    return {
      ok: false,
      status: 502,
      response: {
        error:
          'The translation service returned an unexpected response format.',
        code: 'INVALID_OUTPUT',
        layer: 'output-validation',
        details: { route, reason: 'DeepL response did not match expected schema' },
      },
    }
  }

  const translation = raw.translations[0]

  // --- Non-empty text ---
  if (!translation.text || translation.text.trim() === '') {
    return {
      ok: false,
      status: 502,
      response: {
        error: 'The translation service returned an empty translation.',
        code: 'INVALID_OUTPUT',
        layer: 'output-validation',
        details: { route, reason: 'translated text is empty' },
      },
    }
  }

  // --- Confidence: source language ---
  const detectedSourceLanguage = translation.detected_source_language
  const sourceLangMismatch =
    detectedSourceLanguage?.toUpperCase() !== 'EN' &&
    detectedSourceLanguage !== undefined

  // --- PII re-detection on the output ---
  const piiResult = checkOutputPii(translation.text, route)
  if (!piiResult.ok) {
    return piiResult
  }

  return {
    ok: true,
    value: {
      translatedText: translation.text,
      detectedSourceLanguage,
      sourceLangMismatch,
    },
  }
}

/**
 * Type guard for the DeepL response body shape.
 * Checks that `translations` is a non-empty array whose first element has
 * string `text` and string `detected_source_language` fields.
 */
function isDeepLResponseBody(value: unknown): value is DeepLResponseBody {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>

  if (!Array.isArray(obj['translations']) || obj['translations'].length === 0) {
    return false
  }

  const first = obj['translations'][0] as Record<string, unknown>
  return (
    typeof first['text'] === 'string' &&
    typeof first['detected_source_language'] === 'string'
  )
}

// ---------------------------------------------------------------------------
// TTS — HF Space audio response validation
// ---------------------------------------------------------------------------

/**
 * MIME types accepted as valid TTS audio output.
 * The HF Space provider may return any of these depending on the model/config.
 */
const ACCEPTED_AUDIO_CONTENT_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/ogg; codecs=opus',
  'audio/webm',
  'audio/webm; codecs=opus',
  'audio/flac',
])

/**
 * Minimum audio buffer size in bytes. Responses below this threshold are
 * almost certainly error payloads returned with the wrong Content-Type.
 *
 * 512 bytes is a conservative lower bound — even a 100ms 8-kHz mono WAV is
 * ~1 600 bytes; anything smaller is almost certainly not valid audio.
 */
const AUDIO_MIN_BYTES = 512

/**
 * Maximum audio buffer size in bytes (50 MB).
 * Acts as a circuit-breaker against runaway TTS responses that would exhaust
 * server memory before the client receives them.
 */
const AUDIO_MAX_BYTES = 50 * 1024 * 1024

/**
 * Result returned from `validateTtsOutput` on success.
 */
export interface ValidatedTtsOutput {
  audio: ArrayBuffer
  contentType: string
}

/**
 * Validates the raw response from the HF Space TTS provider.
 *
 * Checks performed (in order):
 * 1. Content-Type header is one of the accepted audio MIME types.
 * 2. Audio buffer size is within `[AUDIO_MIN_BYTES, AUDIO_MAX_BYTES]`.
 *
 * @param audio       - The ArrayBuffer received from the TTS provider.
 * @param contentType - The Content-Type header value from the provider response.
 * @param route       - API route path for structured error details (e.g. "/api/tts").
 */
export function validateTtsOutput(
  audio: ArrayBuffer,
  contentType: string,
  route: string
): GuardrailResult<ValidatedTtsOutput> {
  // --- Content-Type validation ---
  // Strip parameters like "; charset=utf-8" before the set lookup, but keep
  // "codecs=..." which is part of the meaningful MIME type for webm/ogg.
  const normalisedContentType = contentType.trim().toLowerCase()
  const baseContentType = normalisedContentType.split(';')[0].trim()
  const isAccepted =
    ACCEPTED_AUDIO_CONTENT_TYPES.has(normalisedContentType) ||
    ACCEPTED_AUDIO_CONTENT_TYPES.has(baseContentType)

  if (!isAccepted) {
    return {
      ok: false,
      status: 502,
      response: {
        error:
          'The speech synthesis service returned an unexpected content type.',
        code: 'INVALID_AUDIO_CONTENT_TYPE',
        layer: 'output-validation',
        details: {
          route,
          receivedContentType: contentType,
          acceptedTypes: Array.from(ACCEPTED_AUDIO_CONTENT_TYPES),
        },
      },
    }
  }

  // --- Buffer size validation ---
  const byteLength = audio.byteLength

  if (byteLength < AUDIO_MIN_BYTES) {
    return {
      ok: false,
      status: 502,
      response: {
        error:
          'The speech synthesis service returned an audio response that is too small to be valid.',
        code: 'AUDIO_SIZE_OUT_OF_BOUNDS',
        layer: 'output-validation',
        details: {
          route,
          byteLength,
          minBytes: AUDIO_MIN_BYTES,
        },
      },
    }
  }

  if (byteLength > AUDIO_MAX_BYTES) {
    return {
      ok: false,
      status: 502,
      response: {
        error:
          'The speech synthesis service returned an audio response that exceeds the maximum allowed size.',
        code: 'AUDIO_SIZE_OUT_OF_BOUNDS',
        layer: 'output-validation',
        details: {
          route,
          byteLength,
          maxBytes: AUDIO_MAX_BYTES,
        },
      },
    }
  }

  return { ok: true, value: { audio, contentType: normalisedContentType } }
}
