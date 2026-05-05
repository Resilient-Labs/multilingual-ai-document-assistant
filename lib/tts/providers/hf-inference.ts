/**
 * HF Inference Endpoint provider for the English TTS model.
 *
 * Uses the native HuggingFace Inference Endpoint API — no Space layer.
 * The endpoint is created by deploying Resilient-Coders/coqui-vctk-en with
 * the handler.py from infra/tts-handlers/en/.
 *
 * Resolution order for the endpoint URL:
 *  1. HF_TTS_ENDPOINT_EN  — dedicated Inference Endpoint URL (fastest, always-warm)
 *  2. HF_TOKEN present    — falls back to the HF Serverless Inference API
 *                           (api-inference.huggingface.co/models/<model>)
 *
 * Standard HF Inference API payload:
 *   { "inputs": "<text>", "parameters": { "speaker_id": "<id>" } }
 *
 * For languages other than English, this provider throws and the router falls
 * back to hf-space which handles en/es/vi via the Space.
 */

import type { Gender, TtsSynthesisResult } from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'

const HF_TOKEN = process.env.HF_TOKEN?.trim()
const HF_TTS_ENDPOINT_EN = process.env.HF_TTS_ENDPOINT_EN?.trim()

const EN_MODEL_ID = 'Resilient-Coders/coqui-vctk-en'
const SERVERLESS_BASE = 'https://api-inference.huggingface.co/models'

const COQUI_TTS_FEMININE_SPEAKER =
  process.env.COQUI_TTS_FEMININE_SPEAKER ?? 'p228'
const COQUI_TTS_MASCULINE_SPEAKER =
  process.env.COQUI_TTS_MASCULINE_SPEAKER ?? 'p226'

// Dedicated Inference Endpoints are always-warm — no cold-start buffer needed.
// Allow up to 3 minutes to absorb scale-to-zero cold starts
const SYNTH_TIMEOUT_MS = 180_000

function getEndpointUrl(): string {
  if (HF_TTS_ENDPOINT_EN) return HF_TTS_ENDPOINT_EN.replace(/\/$/, '')
  return `${SERVERLESS_BASE}/${EN_MODEL_ID}`
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
 * Returns true when this provider is configured and should be used.
 * Requires either a dedicated endpoint URL or an HF token for serverless.
 */
export function isHfInferenceConfigured(lang: string): boolean {
  if (lang !== 'en') return false
  return Boolean(HF_TTS_ENDPOINT_EN) || Boolean(HF_TOKEN)
}

export async function synthesizeWithHfInference(input: {
  text: string
  targetLang: string
  gender: Gender
}): Promise<TtsSynthesisResult> {
  if (input.targetLang !== 'en') {
    throw new TtsError(
      'HF Inference provider only handles English; use hf-space for es/vi',
      503
    )
  }

  if (!HF_TTS_ENDPOINT_EN && !HF_TOKEN) {
    throw new TtsError(
      'Set HF_TTS_ENDPOINT_EN (dedicated endpoint) or HF_TOKEN (serverless) to use HF Inference TTS.',
      503
    )
  }

  const endpointUrl = getEndpointUrl()

  type HfBody = { inputs: string; parameters: Record<string, string> }
  const body: HfBody = {
    inputs: input.text,
    parameters: {
      speaker_id:
        input.gender === 'masculine'
          ? COQUI_TTS_MASCULINE_SPEAKER
          : COQUI_TTS_FEMININE_SPEAKER,
    },
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

    // 503 with { "error": "Model … is currently loading" } = model warming up
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
      model: EN_MODEL_ID,
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
