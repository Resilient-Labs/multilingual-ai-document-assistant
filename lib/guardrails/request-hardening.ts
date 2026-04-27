/**
 * Request hardening for the guardrails pipeline (Layer 3).
 *
 * This layer builds the outgoing upstream API payload from already-validated
 * inputs and ensures:
 *
 * DeepL (translate route)
 * - `source_lang` is always forced to 'EN' — not user-controllable.
 * - `target_lang` is mapped via the internal DEEPL_LANG_MAP (no raw user value).
 * - `text` is passed as a single-element array (DeepL's expected shape).
 * - Only the three allowed keys are present; no arbitrary keys can be injected.
 * - Outgoing text length is re-checked against DeepL's per-request limit.
 *
 * HF Space TTS (tts route)
 * - `language` is derived from the validated targetLang, never from raw input.
 * - `speaker_idx` is resolved from the gender enum only for English; its value
 *   comes from server-side env vars and is validated to match the safe pattern
 *   before being sent.  Arbitrary speaker IDs cannot be injected by the caller.
 * - Only the three allowed keys are present; extra keys are stripped.
 * - Outgoing text length is re-checked against the provider's practical limit.
 */

import type { GuardrailResult } from './types'
import type { TranslateSupportedLang, TtsSupportedLang } from './schemas'
import type { Gender } from '@/lib/tts/types'

// ---------------------------------------------------------------------------
// DeepL — translate route
// ---------------------------------------------------------------------------

/**
 * Maps the app's language codes to DeepL v2 target language codes.
 * Kept in sync with the identical map in app/api/translate/route.ts.
 * Source language is always EN per product requirements.
 */
const DEEPL_LANG_MAP: Readonly<Record<TranslateSupportedLang, string>> = {
  en: 'EN-US',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  zh: 'ZH-HANS',
  'zh-TW': 'ZH-HANT',
  ja: 'JA',
  ko: 'KO',
  pt: 'PT-PT',
  it: 'IT',
  ru: 'RU',
  ar: 'AR',
  hi: 'HI',
  nl: 'NL',
  pl: 'PL',
  sv: 'SV',
  tr: 'TR',
  vi: 'VI',
}

/** Maximum characters DeepL accepts in a single API request. */
const DEEPL_MAX_CHARS = 50_000

/** The exact body shape sent to the DeepL v2 /translate endpoint. */
export interface DeepLRequestBody {
  text: [string]
  source_lang: 'EN'
  target_lang: string
}

/**
 * Builds and validates the outgoing DeepL request body.
 *
 * - Forces `source_lang: 'EN'` regardless of what the caller supplies.
 * - Maps `targetLang` through `DEEPL_LANG_MAP` — raw user values never reach
 *   the upstream API.
 * - Re-validates text length against `DEEPL_MAX_CHARS`.
 * - Returns an object containing only the three allowed keys.
 */
export function hardenTranslateRequest(
  text: string,
  targetLang: TranslateSupportedLang
): GuardrailResult<DeepLRequestBody> {
  if (text.length > DEEPL_MAX_CHARS) {
    return {
      ok: false,
      status: 422,
      response: {
        error: `Text exceeds the maximum length of ${DEEPL_MAX_CHARS} characters allowed by the translation service.`,
        code: 'MALFORMED_UPSTREAM_REQUEST',
        layer: 'request-hardening',
        details: { maxChars: DEEPL_MAX_CHARS, receivedLength: text.length },
      },
    }
  }

  const target_lang = DEEPL_LANG_MAP[targetLang]
  if (!target_lang) {
    return {
      ok: false,
      status: 422,
      response: {
        error: `Language '${targetLang}' cannot be mapped to a DeepL target language code.`,
        code: 'MALFORMED_UPSTREAM_REQUEST',
        layer: 'request-hardening',
        details: { targetLang },
      },
    }
  }

  const body: DeepLRequestBody = {
    text: [text],
    source_lang: 'EN',
    target_lang,
  }

  return { ok: true, value: body }
}

// ---------------------------------------------------------------------------
// HF Space TTS — tts route
// ---------------------------------------------------------------------------

/** Maximum characters the HF Space TTS provider handles per request. */
const HF_SPACE_MAX_CHARS = 8_000

/**
 * Allowed speaker IDs for the VCTK (Voice Cloning Toolkit) / CSS10 (Cross-Lingual Single Speaker 10 languages) Coqui models hosted on HF Space.
 *
 * These are the p-series speaker IDs from the VCTK corpus. The pattern
 * `p` followed by 3 digits is the only format the HF Space model accepts.
 * Values outside this pattern are rejected before being sent upstream.
 */
const SPEAKER_IDX_PATTERN = /^p\d{3}$/

/**
 * Reads the speaker_idx from environment variables and validates its format.
 * Falls back to the default VCTK speaker IDs if the env vars are not set.
 *
 * Called at request time (not module load) so that env var changes during
 * tests do not require module re-import.
 */
function resolveSpeakerIdx(gender: Gender): string {
  const envVar =
    gender === 'masculine'
      ? process.env.COQUI_TTS_MASCULINE_SPEAKER
      : process.env.COQUI_TTS_FEMININE_SPEAKER

  const defaults: Record<Gender, string> = {
    masculine: 'p226',
    feminine: 'p228',
  }

  return envVar?.trim() || defaults[gender]
}

/** The exact body shape sent to the HF Space /synthesize endpoint. */
export interface HfSpaceRequestBody {
  text: string
  language: string
  speaker_idx?: string
}

/**
 * Builds and validates the outgoing HF Space TTS request body.
 *
 * - `language` is derived from the validated `targetLang` — never from raw input.
 * - `speaker_idx` is resolved from the gender enum only for English; its value
 *   is read from server-side env vars and validated against `SPEAKER_IDX_PATTERN`
 *   before being included. Arbitrary speaker IDs cannot be injected by callers.
 * - Re-validates text length against `HF_SPACE_MAX_CHARS`.
 * - Returns an object containing only the allowed keys.
 */
export function hardenTtsRequest(
  text: string,
  targetLang: TtsSupportedLang,
  gender: Gender
): GuardrailResult<HfSpaceRequestBody> {
  if (text.length > HF_SPACE_MAX_CHARS) {
    return {
      ok: false,
      status: 422,
      response: {
        error: `Text exceeds the maximum length of ${HF_SPACE_MAX_CHARS} characters allowed by the speech synthesis service.`,
        code: 'MALFORMED_UPSTREAM_REQUEST',
        layer: 'request-hardening',
        details: { maxChars: HF_SPACE_MAX_CHARS, receivedLength: text.length },
      },
    }
  }

  const body: HfSpaceRequestBody = {
    text,
    language: targetLang,
  }

  if (targetLang === 'en') {
    const speakerIdx = resolveSpeakerIdx(gender)

    if (!SPEAKER_IDX_PATTERN.test(speakerIdx)) {
      return {
        ok: false,
        status: 500,
        response: {
          error:
            'Speech synthesis service is misconfigured: invalid speaker identifier.',
          code: 'MALFORMED_UPSTREAM_REQUEST',
          layer: 'request-hardening',
          details: {
            reason: 'speaker_idx does not match expected pattern',
            pattern: SPEAKER_IDX_PATTERN.toString(),
          },
        },
      }
    }

    body.speaker_idx = speakerIdx
  }

  return { ok: true, value: body }
}
