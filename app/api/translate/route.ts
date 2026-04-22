import { NextResponse } from 'next/server'
import {
  runTranslateGuardrails,
  validateTranslateOutput,
  translateFallback,
  internalErrorFallback,
  guardrailLog,
  type GuardrailResult,
} from '@/lib/guardrails'

const ROUTE = '/api/translate'

// DEEPL_API_KEY — set in .env.local
const DEEPL_API_KEY = process.env.DEEPL_API_KEY

/**
 * Converts a `GuardrailResult<never>` failure (always `ok: false`) into a
 * NextResponse. All fallback helpers are typed as `GuardrailResult<never>` and
 * always return the failure branch; this helper narrows the discriminated union
 * so we can access `.response` and `.status` without casting everywhere.
 */
function fallbackResponse(fb: GuardrailResult<never>) {
  if (fb.ok) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json(fb.response, { status: fb.status })
}

/**
 * POST /api/translate
 * Body: { text: string, targetLang: string }
 * Returns: { translatedText: string }
 */
export async function POST(request: Request) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return fallbackResponse(
      internalErrorFallback({ route: ROUTE, reason: 'Failed to parse request body as JSON' })
    )
  }

  // ── Layers 1–3 + circuit breaker preflight ────────────────────────────────
  const pre = runTranslateGuardrails(rawBody, ROUTE)
  if (!pre.ok) return NextResponse.json(pre.response, { status: pre.status })

  const { sanitizedText, hardenedBody, circuitBreaker } = pre.value

  if (!DEEPL_API_KEY) {
    circuitBreaker.onFailure()
    guardrailLog('error', {
      route: ROUTE,
      layer: 'fallback',
      action: 'reject',
      reason: 'DEEPL_API_KEY is not configured',
    })
    return fallbackResponse(
      translateFallback({ inputLength: sanitizedText.length, reason: 'service-not-configured' })
    )
  }

  // ── Upstream call (Layer 3 hardened body forwarded to DeepL) ─────────────
  let rawApiResponse: unknown
  try {
    const deeplRes = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hardenedBody),
    })

    if (!deeplRes.ok) {
      const errorText = await deeplRes.text()
      guardrailLog('error', {
        route: ROUTE,
        layer: 'fallback',
        action: 'reject',
        reason: 'DeepL API returned a non-2xx status',
        meta: { status: deeplRes.status, bodyLength: errorText.length },
      })
      circuitBreaker.onFailure()
      return fallbackResponse(translateFallback({ inputLength: sanitizedText.length }))
    }

    rawApiResponse = await deeplRes.json()
    circuitBreaker.onSuccess()
  } catch (err) {
    circuitBreaker.onFailure()
    guardrailLog('error', {
      route: ROUTE,
      layer: 'fallback',
      action: 'reject',
      reason: 'DeepL fetch threw an unexpected error',
      meta: { errorMessage: err instanceof Error ? err.message : String(err) },
    })
    return fallbackResponse(translateFallback({ inputLength: sanitizedText.length }))
  }

  // ── Layer 4: Output validation ────────────────────────────────────────────
  const out = validateTranslateOutput(rawApiResponse, ROUTE)
  if (!out.ok) return NextResponse.json(out.response, { status: out.status })

  if (out.value.sourceLangMismatch) {
    guardrailLog('warn', {
      route: ROUTE,
      layer: 'output-validation',
      action: 'warn',
      reason: 'DeepL detected a non-English source language',
      meta: { detectedSourceLanguage: out.value.detectedSourceLanguage },
    })
  }

  return NextResponse.json({ translatedText: out.value.translatedText })
}
