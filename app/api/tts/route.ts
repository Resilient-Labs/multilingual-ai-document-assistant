import { NextResponse } from 'next/server'
import { evaluateAsync } from '@/lib/evaluate'
import { synthesizeSpeech } from '@/lib/tts/router'
import { TtsError } from '@/lib/tts/types'
import {
  runTtsGuardrails,
  validateTtsOutput,
  ttsFallback,
  internalErrorFallback,
  guardrailLog,
  logPass,
  type GuardrailResult,
} from '@/lib/guardrails'
import { preprocessText } from '@/lib/tts/preprocess'  // ← Add this import

const ROUTE = '/api/tts'

function fallbackResponse(fb: GuardrailResult<never>) {
  if (fb.ok) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json(fb.response, { status: fb.status })
}

export async function POST(request: Request) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return fallbackResponse(
      internalErrorFallback({ route: ROUTE, reason: 'Failed to parse request body as JSON' })
    )
  }

  const pre = runTtsGuardrails(rawBody, ROUTE)
  if (!pre.ok) return NextResponse.json(pre.response, { status: pre.status })

  const { sanitizedText, targetLang, gender, circuitBreaker } = pre.value

  // ── NEW: Preprocess text ────────────────────────────────────────────────────
  const cleanedText = preprocessText(sanitizedText, targetLang)
  
  if (!cleanedText || cleanedText.trim() === '') {
    return fallbackResponse(
      internalErrorFallback({ route: ROUTE, reason: 'Text could not be processed for speech' })
    )
  }

  // ── Upstream call ────────────────────────────────────────────────────────
  let result: Awaited<ReturnType<typeof synthesizeSpeech>>
  try {
    result = await synthesizeSpeech({ text: cleanedText, targetLang, gender })  // ← Use cleanedText
    circuitBreaker.onSuccess()
  } catch (err) {
    circuitBreaker.onFailure()

    if (err instanceof TtsError) {
      guardrailLog('error', {
        route: ROUTE,
        layer: 'fallback',
        action: 'reject',
        reason: 'TTS provider threw a TtsError',
        meta: { status: err.status, errorMessage: err.message },
      })
    } else {
      guardrailLog('error', {
        route: ROUTE,
        layer: 'fallback',
        action: 'reject',
        reason: 'synthesizeSpeech threw an unexpected error',
        meta: { errorMessage: err instanceof Error ? err.message : String(err) },
      })
    }

    return fallbackResponse(
      ttsFallback({ inputLength: cleanedText.length, targetLang })  // ← Use cleanedText
    )
  }

  // ── Layer 4: Output validation ────────────────────────────────────────────
  const out = validateTtsOutput(result.audio, result.contentType, ROUTE)
  if (!out.ok) {
    guardrailLog('error', {
      route: ROUTE,
      layer: 'output-validation',
      action: 'reject',
      reason: out.response.error,
      meta: { code: out.response.code },
    })
    return NextResponse.json(out.response, { status: out.status })
  }

  logPass(ROUTE, 'output-validation', 'TTS output passed all validation checks', {
    byteLength: out.value.audio.byteLength,
    contentType: out.value.contentType,
  })

  evaluateAsync({
    input: cleanedText,
    output: `audio/${out.value.contentType} — ${out.value.audio.byteLength} bytes`,
    model: result.model,
    feature: 'tts',
    metadata: {
      provider: result.provider,
      audioBytes: out.value.audio.byteLength,
      contentType: out.value.contentType,
    },
  })
  return new NextResponse(out.value.audio, {
    status: 200,
    headers: {
      'Content-Type': out.value.contentType,
      'Cache-Control': 'no-store',
      'X-TTS-Provider': result.provider,
      'X-TTS-Model': result.model,
    },
  })
}