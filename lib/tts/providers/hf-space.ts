import type { Gender, TtsSynthesisResult } from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'

const HF_TTS_SPACE_URL = process.env.HF_TTS_SPACE_URL?.trim()
const COQUI_TTS_FEMININE_SPEAKER =
  process.env.COQUI_TTS_FEMININE_SPEAKER ?? 'p228'
const COQUI_TTS_MASCULINE_SPEAKER =
  process.env.COQUI_TTS_MASCULINE_SPEAKER ?? 'p226'

const HF_SPACE_LANGS = new Set(['en', 'es', 'vi'])

const HF_SPACE_MODEL_BY_LANG: Record<string, string> = {
  en: 'Resilient-Coders/coqui-vctk-en',
  es: 'Resilient-Coders/coqui-css10-es',
  vi: 'Resilient-Coders/mms-tts-vie',
}

// Long timeout to absorb HF Space cold-starts (free tier sleeps after ~48h idle).
const SYNTH_TIMEOUT_MS = 180_000

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '')
}

function isHfSpaceUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  if (
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('socket hang up')
  ) {
    return true
  }
  const cause = (error as Error & { cause?: unknown }).cause
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT'
    ) {
      return true
    }
    return isHfSpaceUnavailable(cause)
  }
  return false
}

export async function synthesizeWithHfSpace(input: {
  text: string
  targetLang: string
  gender: Gender
}): Promise<TtsSynthesisResult> {
  if (!HF_TTS_SPACE_URL) {
    throw new TtsError('HF_TTS_SPACE_URL is not configured', 503)
  }

  const lang = input.targetLang === 'auto' ? 'en' : input.targetLang
  if (!HF_SPACE_LANGS.has(lang)) {
    throw new TtsError('HF Space TTS does not support this language', 503)
  }

  const body: { text: string; language: string; speaker_idx?: string } = {
    text: input.text,
    language: lang,
  }
  if (lang === 'en') {
    body.speaker_idx =
      input.gender === 'masculine'
        ? COQUI_TTS_MASCULINE_SPEAKER
        : COQUI_TTS_FEMININE_SPEAKER
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${normalizeBaseUrl(HF_TTS_SPACE_URL)}/synthesize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      const detail = await response.text()
      if (response.status >= 500) {
        throw new TtsError(
          detail ? `HF Space TTS error: ${detail}` : 'HF Space TTS error',
          503
        )
      }
      throw new TtsError(
        detail ? `HF Space TTS error: ${detail}` : 'HF Space TTS error',
        response.status
      )
    }

    const audioBuffer = await response.arrayBuffer()
    if (audioBuffer.byteLength === 0) {
      throw new TtsError('HF Space TTS returned empty audio', 502)
    }

    return {
      audio: audioBuffer,
      contentType: response.headers.get('content-type') ?? 'audio/wav',
      provider: 'hf-space',
      model: HF_SPACE_MODEL_BY_LANG[lang] ?? HF_SPACE_MODEL_BY_LANG.en,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TtsError('HF Space TTS request timed out', 504)
    }
    if (isHfSpaceUnavailable(error)) {
      throw new TtsError('HF Space TTS is not running', 503)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
