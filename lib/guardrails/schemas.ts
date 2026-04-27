/**
 * Zod schemas for the guardrails pipeline (Layer 1 — input validation).
 *
 * These schemas are the authoritative definition of what the translate and TTS
 * routes accept. Both routes parse and validate the raw request body against
 * these schemas before any further processing.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Translate
// ---------------------------------------------------------------------------

/**
 * All language codes accepted by the translate route.
 * Must stay in sync with DEEPL_LANG_MAP in app/api/translate/route.ts.
 */
export const TRANSLATE_SUPPORTED_LANGS = [
  'en',
  'es',
  'fr',
  'de',
  'zh',
  'zh-TW',
  'ja',
  'ko',
  'pt',
  'it',
  'ru',
  'ar',
  'hi',
  'nl',
  'pl',
  'sv',
  'tr',
  'vi',
] as const

export type TranslateSupportedLang = (typeof TRANSLATE_SUPPORTED_LANGS)[number]

/**
 * Schema for POST /api/translate request bodies.
 *
 * - `text`       — the English source text to translate; max 50 000 chars to
 *                  stay well under DeepL's per-request limit.
 * - `targetLang` — one of the app's supported locale codes; validated against
 *                  the same set as DEEPL_LANG_MAP to fail fast before hitting
 *                  the external API.
 */
export const TranslateInputSchema = z.object({
  text: z
    .string({ error: 'text is required' })
    .min(1, 'text must not be empty')
    .max(50_000, 'text must not exceed 50 000 characters'),
  targetLang: z.enum(TRANSLATE_SUPPORTED_LANGS, {
    message: `targetLang must be one of: ${TRANSLATE_SUPPORTED_LANGS.join(', ')}`,
  }),
})

export type TranslateInput = z.infer<typeof TranslateInputSchema>

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

/**
 * Language codes supported by the TTS route.
 * Intentionally narrower than the translate route — only the locales backed
 * by the HF Space voices are accepted at the route level.
 */
export const TTS_SUPPORTED_LANGS = ['en', 'es', 'vi'] as const

export type TtsSupportedLang = (typeof TTS_SUPPORTED_LANGS)[number]

/**
 * Schema for POST /api/tts request bodies.
 *
 * - `text`       — the text to synthesize; max 8 000 chars per the provider's
 *                  practical limit.
 * - `targetLang` — one of the TTS-supported locale codes.
 * - `gender`     — selects the voice model; must be exactly 'masculine' or
 *                  'feminine' to prevent arbitrary speaker index injection.
 */
export const TtsInputSchema = z.object({
  text: z
    .string({ error: 'text is required' })
    .min(1, 'text must not be empty')
    .max(8_000, 'text must not exceed 8 000 characters'),
  targetLang: z.enum(TTS_SUPPORTED_LANGS, {
    message: `targetLang must be one of: ${TTS_SUPPORTED_LANGS.join(', ')}`,
  }),
  gender: z.enum(['masculine', 'feminine'] as const, {
    message: "gender must be 'masculine' or 'feminine'",
  }),
})

export type TtsInput = z.infer<typeof TtsInputSchema>
