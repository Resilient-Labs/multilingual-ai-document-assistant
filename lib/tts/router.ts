import { isDeepgramLanguage } from '@/lib/tts/deepgram-voices'
import { synthesizeWithCoquiLocal } from '@/lib/tts/providers/coqui-local'
import { synthesizeWithDeepgram } from '@/lib/tts/providers/deepgram'
import { synthesizeWithMinimaxReplicate } from '@/lib/tts/providers/minimax-replicate'
import { synthesizeWithXttsReplicate } from '@/lib/tts/providers/xtts-replicate'
import type {
  TtsProvider,
  TtsRequestPayload,
  TtsSynthesisResult,
} from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'

const MINIMAX_PREFERRED_LANGUAGES = new Set(['sv', 'vi'])

export function getTtsProvider(targetLang: string): TtsProvider {
  // 'auto' means the upload used "Detect language"; the app treats source docs as English.
  const lang = targetLang === 'auto' ? 'en' : targetLang

  if (MINIMAX_PREFERRED_LANGUAGES.has(lang)) {
    return 'minimax'
  }

  if (lang === 'en') {
    return 'coqui-local'
  }

  return isDeepgramLanguage(lang) ? 'deepgram' : 'xtts'
}

async function runProvider(
  provider: TtsProvider,
  payload: TtsRequestPayload
): Promise<TtsSynthesisResult> {
  if (provider === 'coqui-local') {
    return synthesizeWithCoquiLocal(payload)
  }

  if (provider === 'deepgram') {
    return synthesizeWithDeepgram(payload)
  }

  if (provider === 'xtts') {
    return synthesizeWithXttsReplicate(payload)
  }

  return synthesizeWithMinimaxReplicate(payload)
}

function getFallbackChain(primaryProvider: TtsProvider): TtsProvider[] {
  if (primaryProvider === 'coqui-local') {
    return ['coqui-local', 'deepgram', 'xtts']
  }

  if (primaryProvider === 'deepgram') {
    return ['deepgram', 'xtts', 'minimax']
  }

  if (primaryProvider === 'xtts') {
    return ['xtts', 'minimax']
  }

  return ['minimax', 'xtts']
}

export async function synthesizeSpeech(
  payload: TtsRequestPayload
): Promise<TtsSynthesisResult> {
  const normalizedPayload: TtsRequestPayload = {
    ...payload,
    targetLang: payload.targetLang === 'auto' ? 'en' : payload.targetLang,
  }
  const primaryProvider = getTtsProvider(normalizedPayload.targetLang)
  const providers = getFallbackChain(primaryProvider)
  let lastError: unknown

  for (const provider of providers) {
    try {
      return await runProvider(provider, normalizedPayload)
    } catch (error) {
      lastError = error
      console.warn(`TTS provider failed: ${provider}`, error)
    }
  }

  if (lastError instanceof TtsError) {
    throw lastError
  }

  throw new TtsError('All TTS providers failed', 502)
}
