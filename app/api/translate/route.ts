import { NextResponse } from 'next/server'
import { getNllbTargetCode } from '@/lib/translation/nllbLanguageMap'
import {
  callTranslateProvider,
  TranslateProviderError,
} from '@/lib/translation/callTranslateProvider'

/**
 * NLLB translation via a dedicated Hugging Face Gradio Space (see
 * `Resilient-Coders/nllb-translator`). Source language is fixed to English
 * per product requirements; target codes come from `APP_TO_NLLB_TARGET`
 * (single source of truth with the translate UI). The actual fetch +
 * parsing lives in `lib/translation/callTranslateProvider`, which drives
 * the Gradio two-step call protocol (`POST /gradio_api/call/translate`
 * then `GET /gradio_api/call/translate/{event_id}`), so tests can mock a
 * single function instead of global `fetch` and error mapping stays in
 * one place. The Space is public — `HF_TOKEN` is optional and only
 * forwarded as a Bearer when set. `HF_TRANSLATE_SPACE_URL` must be the
 * Space base URL (no `/gradio_api/...` suffix); the helper appends the
 * call + event-id paths itself.
 */

/** Long timeout to absorb HF cold starts; matches TTS scale. */
const TRANSLATE_TIMEOUT_MS = 180_000

function resolveTranslateUrl(): string | null {
  const explicit = process.env.HF_TRANSLATE_SPACE_URL?.trim()
  return explicit ? explicit : null
}

/**
 * POST /api/translate
 * Body: { text: string, targetLang: string }
 * Returns: { translatedText: string }
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, targetLang } = (body ?? {}) as {
    text?: unknown
    targetLang?: unknown
  }

  if (typeof text !== 'string' || text.trim() === '') {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  if (typeof targetLang !== 'string' || targetLang === '') {
    return NextResponse.json(
      { error: 'No target language provided' },
      { status: 400 }
    )
  }

  // English short-circuit: no upstream call, no cold start.
  if (targetLang === 'en') {
    return NextResponse.json({ translatedText: text })
  }

  const tgtLang = getNllbTargetCode(targetLang)
  if (!tgtLang) {
    return NextResponse.json(
      { error: `Unsupported target language: ${targetLang}` },
      { status: 400 }
    )
  }

  const url = resolveTranslateUrl()
  if (!url) {
    return NextResponse.json(
      { error: 'Translation service is not configured' },
      { status: 503 }
    )
  }

  const hfToken = process.env.HF_TOKEN?.trim() || undefined

  try {
    const translatedText = await callTranslateProvider({
      text,
      tgtLang,
      url,
      hfToken,
      timeoutMs: TRANSLATE_TIMEOUT_MS,
    })
    return NextResponse.json({ translatedText })
  } catch (err) {
    if (err instanceof TranslateProviderError) {
      // Log status + short snippet only; never tokens or full user text.
      if (err.kind === 'upstream_http_error') {
        console.error(
          'NLLB translate upstream error:',
          err.status,
          err.snippet ?? ''
        )
      }
      if (err.kind === 'network') {
        return NextResponse.json(
          { error: 'Translation service is not configured' },
          { status: 503 }
        )
      }
      // timeout | upstream_http_error | invalid_response | empty_response
      return NextResponse.json(
        { error: 'Translation service returned an error' },
        { status: 502 }
      )
    }
    // Unknown error: treat as upstream failure rather than leak details.
    console.error('NLLB translate unexpected error')
    return NextResponse.json(
      { error: 'Translation service returned an error' },
      { status: 502 }
    )
  }
}
