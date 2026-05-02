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
 *  1. hf-inference — when HF_TTS_ENDPOINT_EN or HF_TOKEN is configured AND
 *                    the language is English (the only model with a handler.py)
 *  2. hf-space    — all other cases (es/vi always, en as fallback)
 *
 * Note: text preprocessing is handled upstream in app/api/tts/route.ts before
 * synthesizeSpeech is called — do not preprocess here to avoid double-processing.
 */
export function getTtsProvider(targetLang: string): TtsProvider {
  if (isHfInferenceConfigured(targetLang)) return 'hf-inference'
  return 'hf-space'
}

export async function synthesizeSpeech(
  payload: TtsRequestPayload
): Promise<TtsSynthesisResult> {
  const normalizedPayload: TtsRequestPayload = {
    ...payload,
    targetLang: payload.targetLang === 'auto' ? 'en' : payload.targetLang,
  }

  const provider = getTtsProvider(normalizedPayload.targetLang)
  if (provider === 'hf-inference') {
    return synthesizeWithHfInference(normalizedPayload)
  }
  return synthesizeWithHfSpace(normalizedPayload)
}
