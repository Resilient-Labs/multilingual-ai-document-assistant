import { NextResponse } from 'next/server'
import { synthesizeSpeech } from '@/lib/tts/router'
import type { Gender, TtsRequestPayload } from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'

const VALID_GENDERS: Gender[] = ['masculine', 'feminine']
const MAX_TTS_TEXT_LENGTH = 8000

function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && VALID_GENDERS.includes(value as Gender)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, targetLang, gender } = body as Partial<TtsRequestPayload>

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { error: 'No text provided for speech' },
        { status: 400 }
      )
    }

    if (text.length > MAX_TTS_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: `Text is too long for TTS. Please reduce to ${MAX_TTS_TEXT_LENGTH} characters or less.`,
        },
        { status: 400 }
      )
    }

    if (!targetLang || typeof targetLang !== 'string') {
      return NextResponse.json(
        { error: 'No target language provided' },
        { status: 400 }
      )
    }

    if (!isGender(gender)) {
      return NextResponse.json(
        { error: 'Invalid gender. Choose masculine or feminine.' },
        { status: 400 }
      )
    }

    const result = await synthesizeSpeech({
      text,
      targetLang,
      gender,
    })

    return new NextResponse(result.audio, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'no-store',
        'X-TTS-Provider': result.provider,
        'X-TTS-Model': result.model,
      },
    })
  } catch (error) {
    if (error instanceof TtsError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error('TTS route error:', error)
    return NextResponse.json(
      { error: 'Text-to-speech failed' },
      { status: 500 }
    )
  }
}
