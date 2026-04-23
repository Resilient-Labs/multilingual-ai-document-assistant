import { synthesizeWithHfSpace } from '@/lib/tts/providers/hf-space'
import type { TtsProvider, TtsRequestPayload, TtsSynthesisResult } from '@/lib/tts/types'
import { preprocessTextForTts } from '@/lib/tts/preprocess'

export function getTtsProvider(_targetLang: string): TtsProvider {
  return 'hf-space'
}

export async function synthesizeSpeech(
  payload: TtsRequestPayload
): Promise<TtsSynthesisResult> {
  const normalizedPayload: TtsRequestPayload = {
    ...payload,
    text: preprocessTextForTts(payload.text, payload.targetLang),
    targetLang: payload.targetLang === 'auto' ? 'en' : payload.targetLang,
  }
  return synthesizeWithHfSpace(normalizedPayload)
}
