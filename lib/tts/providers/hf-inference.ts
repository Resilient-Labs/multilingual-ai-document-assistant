/**
 * HF Inference Endpoint provider for TTS — supports en, es, and vi.
 *
 * Each language maps to its own dedicated HF Inference Endpoint:
 *   HF_TTS_ENDPOINT_EN → Resilient-Coders/coqui-vctk-en  (English, multi-speaker)
 *   HF_TTS_ENDPOINT_ES → Resilient-Coders/coqui-css10-es  (Spanish, single-speaker)
 *   HF_TTS_ENDPOINT_VI → Resilient-Coders/mms-tts-vie     (Vietnamese, fairseq)
 *
 * Standard HF Inference API payload:
 *   { "inputs": "<text>", "parameters": { "speaker_id": "<id>" } }  (en only)
 *   { "inputs": "<text>" }  (es, vi — single speaker)
 *
 * Allow up to 3 minutes to absorb scale-to-zero cold starts.
 */

import type { Gender, TtsSynthesisResult } from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'

const HF_TOKEN = process.env.HF_TOKEN?.trim()

const HF_TTS_ENDPOINT_EN = process.env.HF_TTS_ENDPOINT_EN?.trim()
const HF_TTS_ENDPOINT_ES = process.env.HF_TTS_ENDPOINT_ES?.trim()
const HF_TTS_ENDPOINT_VI = process.env.HF_TTS_ENDPOINT_VI?.trim()

const ENDPOINT_BY_LANG: Record<string, string | undefined> = {
  en: HF_TTS_ENDPOINT_EN,
  es: HF_TTS_ENDPOINT_ES,
  vi: HF_TTS_ENDPOINT_VI,
}

const MODEL_BY_LANG: Record<string, string> = {
  en: 'Resilient-Coders/coqui-vctk-en',
  es: 'Resilient-Coders/coqui-css10-es',
  vi: 'Resilient-Coders/mms-tts-vie',
}

const COQUI_TTS_FEMININE_SPEAKER =
  process.env.COQUI_TTS_FEMININE_SPEAKER ?? 'p228'
const COQUI_TTS_MASCULINE_SPEAKER =
  process.env.COQUI_TTS_MASCULINE_SPEAKER ?? 'p226'

const SYNTH_TIMEOUT_MS = 180_000

function getEndpointUrl(lang: string): string {
  const dedicated = ENDPOINT_BY_LANG[lang]
  if (dedicated) return dedicated.replace(/\/$/, '')
  return `https://api-inference.huggingface.co/models/${MODEL_BY_LANG[lang]}`
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  if (
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('fetch failed') ||
    msg.includes('networkerror') ||
    msg.includes('socket hang up')
  )
    return true
  const cause = (error as Error & { cause?: unknown }).cause
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT')
      return true
    return isNetworkError(cause)
  }
  return false
}

/**
 * Returns true when this provider is configured for the given language.
 * A dedicated endpoint URL OR an HF token is sufficient.
 */
export function isHfInferenceConfigured(lang: string): boolean {
  if (!MODEL_BY_LANG[lang]) return false
  return Boolean(ENDPOINT_BY_LANG[lang]) || Boolean(HF_TOKEN)
}

export async function synthesizeWithHfInference(input: {
  text: string
  targetLang: string
  gender: Gender
}): Promise<TtsSynthesisResult> {
  const lang = input.targetLang

  if (!MODEL_BY_LANG[lang]) {
    throw new TtsError(`HF Inference TTS does not support language: ${lang}`, 503)
  }

  if (!ENDPOINT_BY_LANG[lang] && !HF_TOKEN) {
    throw new TtsError(
      `Set HF_TTS_ENDPOINT_${lang.toUpperCase()} or HF_TOKEN to use HF Inference TTS for ${lang}.`,
      503
    )
  }

  const endpointUrl = getEndpointUrl(lang)

  type HfBody = { inputs: string; parameters?: Record<string, string> }
  const body: HfBody = { inputs: input.text }
  if (lang === 'en') {
    body.parameters = {
      speaker_id:
        input.gender === 'masculine'
          ? COQUI_TTS_MASCULINE_SPEAKER
          : COQUI_TTS_FEMININE_SPEAKER,
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'audio/wav, audio/*;q=0.9',
  }
  if (HF_TOKEN) {
    headers['Authorization'] = `Bearer ${HF_TOKEN}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS)

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (response.status === 503) {
      const detail = await response.text()
      throw new TtsError(
        detail.toLowerCase().includes('loading')
          ? 'TTS model is loading, please retry in a moment.'
          : `HF Inference TTS unavailable: ${detail}`,
        503
      )
    }

    if (!response.ok) {
      const detail = await response.text()
      throw new TtsError(
        detail ? `HF Inference TTS error: ${detail}` : 'HF Inference TTS error',
        response.status >= 500 ? 503 : response.status
      )
    }

    const audioBuffer = await response.arrayBuffer()
    if (audioBuffer.byteLength === 0) {
      throw new TtsError('HF Inference TTS returned empty audio', 502)
    }

    return {
      audio: audioBuffer,
      contentType: response.headers.get('content-type') ?? 'audio/wav',
      provider: 'hf-inference',
      model: MODEL_BY_LANG[lang],
    }
  } catch (error) {
    if (error instanceof TtsError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TtsError('HF Inference TTS request timed out', 504)
    }
    if (isNetworkError(error)) {
      throw new TtsError('Could not reach HF Inference endpoint', 503)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
