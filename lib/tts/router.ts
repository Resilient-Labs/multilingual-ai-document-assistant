import {
  isHfInferenceConfigured,
  synthesizeWithHfInference,
} from '@/lib/tts/providers/hf-inference'
import { synthesizeWithHfSpace } from '@/lib/tts/providers/hf-space'
import type { TtsProvider, TtsRequestPayload, TtsSynthesisResult } from '@/lib/tts/types'

/**
 * Resolve which TTS backend to use for a given language.
 *
 * Priority:
 *  1. hf-inference — when HF_TTS_ENDPOINT_<LANG> or HF_TOKEN is configured
 *                    for the requested language. Dedicated endpoints can
 *                    be paused / scaled to zero and return 503 / 404, so
 *                    we automatically fall back to hf-space below when
 *                    that happens.
 *  2. hf-space    — Coqui Space at HF_TTS_SPACE_URL. Used directly when
 *                   no dedicated endpoint is configured, AND as the
 *                   automatic fallback when the dedicated endpoint
 *                   throws.
 *
 * Note: text preprocessing is handled upstream in app/api/tts/route.ts before
 * synthesizeSpeech is called — do not preprocess here to avoid double-processing.
 */
export function getTtsProvider(targetLang: string): TtsProvider {
  if (isHfInferenceConfigured(targetLang)) return 'hf-inference'
  return 'hf-space'
}

const HF_TTS_SPACE_URL_CONFIGURED = Boolean(process.env.HF_TTS_SPACE_URL?.trim())

export async function synthesizeSpeech(
  payload: TtsRequestPayload
): Promise<TtsSynthesisResult> {
  const normalizedPayload: TtsRequestPayload = {
    ...payload,
    targetLang: payload.targetLang === 'auto' ? 'en' : payload.targetLang,
  }

  const provider = getTtsProvider(normalizedPayload.targetLang)
  if (provider === 'hf-inference') {
    try {
      return await synthesizeWithHfInference(normalizedPayload)
    } catch (err) {
      if (!HF_TTS_SPACE_URL_CONFIGURED) throw err
      /* eslint-disable no-console -- one-line ops note when we fall back */
      console.warn(
        '[tts] hf-inference failed, falling back to hf-space:',
        err instanceof Error ? err.message : String(err)
      )
      /* eslint-enable no-console */
      return synthesizeWithHfSpace(normalizedPayload)
    }
  }
  return synthesizeWithHfSpace(normalizedPayload)
}
