import type { Gender, TtsSynthesisResult } from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'

const COQUI_TTS_URL = process.env.COQUI_TTS_URL ?? 'http://127.0.0.1:5002'
const COQUI_TTS_FEMININE_SPEAKER =
  process.env.COQUI_TTS_FEMININE_SPEAKER ?? 'p228'
const COQUI_TTS_MASCULINE_SPEAKER =
  process.env.COQUI_TTS_MASCULINE_SPEAKER ?? 'p226'

const MODEL_NAME = 'tts_models/en/vctk/vits'
const SYNTH_TIMEOUT_MS = 60_000

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '')
}

function isLocalCoquiUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  if (
    message.includes('econnrefused') ||
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('socket hang up')
  ) {
    return true
  }

  const cause = (error as Error & { cause?: unknown }).cause
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return true
    }
    return isLocalCoquiUnavailable(cause)
  }

  return false
}

export async function synthesizeWithCoquiLocal(input: {
  text: string
  targetLang: string
  gender: Gender
}): Promise<TtsSynthesisResult> {
  if (input.targetLang !== 'en') {
    throw new TtsError('Local Coqui TTS is only configured for English', 503)
  }

  const speaker_idx =
    input.gender === 'masculine'
      ? COQUI_TTS_MASCULINE_SPEAKER
      : COQUI_TTS_FEMININE_SPEAKER

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${normalizeBaseUrl(COQUI_TTS_URL)}/synthesize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.text, speaker_idx }),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      const detail = await response.text()
      throw new TtsError(
        detail ? `Local Coqui TTS error: ${detail}` : 'Local Coqui TTS error',
        response.status >= 400 && response.status < 600 ? response.status : 502
      )
    }

    const audioBuffer = await response.arrayBuffer()
    if (audioBuffer.byteLength === 0) {
      throw new TtsError('Local Coqui TTS returned empty audio', 502)
    }

    return {
      audio: audioBuffer,
      contentType: response.headers.get('content-type') ?? 'audio/wav',
      provider: 'coqui-local',
      model: MODEL_NAME,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TtsError('Local Coqui TTS request timed out', 504)
    }
    if (isLocalCoquiUnavailable(error)) {
      throw new TtsError('Local Coqui TTS is not running', 503)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
