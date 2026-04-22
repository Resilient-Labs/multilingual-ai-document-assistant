import { NextResponse } from 'next/server'
import { synthesizeSpeech } from '@/lib/tts/router'
import type { Gender, SpanishAccent, TtsRequestPayload } from '@/lib/tts/types'
import { TtsError } from '@/lib/tts/types'
import { preprocessText } from '@/lib/tts/preprocess'

const VALID_GENDERS: Gender[] = ['masculine', 'feminine']
const VALID_SPANISH_ACCENTS: SpanishAccent[] = [
  'argentine',
  'colombian',
  'latin-american',
  'mexican',
  'peninsular',
]
const MAX_TTS_TEXT_LENGTH = 8000

function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && VALID_GENDERS.includes(value as Gender)
}

function isSpanishAccent(value: unknown): value is SpanishAccent {
  return (
    typeof value === 'string' &&
    VALID_SPANISH_ACCENTS.includes(value as SpanishAccent)
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, targetLang, gender, spanishAccent } =
      body as Partial<TtsRequestPayload>

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

    if (spanishAccent && !isSpanishAccent(spanishAccent)) {
      return NextResponse.json(
        { error: 'Invalid Spanish accent option.' },
        { status: 400 }
      )
    }
    const cleanedText = preprocessText(text, targetLang)

    if (!cleanedText || cleanedText.trim() === '') {
      return NextResponse.json(
        { error: 'Text could not be processed for speech' },
        { status: 400 }
      )
    }

    if (cleanedText.length > MAX_TTS_TEXT_LENGTH) {
      return NextResponse.json( 
        { 
          error: `Processed text is too long for TTS. Please reduce input.`, 
        }, 
        { status: 400 }
      ) 
    }
    // --- Debug logging (dev only) --- 
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TTS preprocess]', {
        before: text.slice(0, 100),
        after: cleanedText.slice(0, 100), 
        lang: targetLang, 
      }) 
    }
    
    // --- Call TTS model ---
    const result = await synthesizeSpeech({
      text: cleanedText,
      targetLang,
      gender,
      spanishAccent,
    })

    // --- Return audio response ---
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
