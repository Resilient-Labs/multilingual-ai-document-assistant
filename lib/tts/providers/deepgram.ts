import { resolveAuraModel } from '@/lib/tts/deepgram-voices'
import type { Gender, SpanishAccent, TtsSynthesisResult } from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY

interface DeepgramInput {
  text: string
  targetLang: string
  gender: Gender
  spanishAccent?: SpanishAccent
}

export async function synthesizeWithDeepgram(
  input: DeepgramInput
): Promise<TtsSynthesisResult> {
  if (!DEEPGRAM_API_KEY) {
    throw new TtsError('Deepgram TTS is not configured', 503)
  }

  const model = resolveAuraModel(
    input.targetLang,
    input.gender,
    input.spanishAccent
  )

  const response = await fetch(
    `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: input.text }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Deepgram TTS error:', response.status, errorText)
    throw new TtsError('Deepgram TTS request failed', 502)
  }

  const audioBuffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') ?? 'audio/wav'

  return {
    audio: audioBuffer,
    contentType,
    provider: 'deepgram',
    model,
  }
}
