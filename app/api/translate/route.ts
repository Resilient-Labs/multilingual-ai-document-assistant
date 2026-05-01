import { NextResponse } from 'next/server'
import { evaluateAsync } from '@/lib/evaluate'
import { getNllbTargetCode } from '@/lib/translation/nllbLanguageMap'
import {
  callTranslateProvider,
  TranslateProviderError,
} from '@/lib/translation/callTranslateProvider'
import {
  runTranslateGuardrails,
  translateFallback,
  internalErrorFallback,
  detectPii,
  guardrailLog,
  logPass,
  logWarn,
  type GuardrailResult,
} from '@/lib/guardrails'

const ROUTE = '/api/translate'

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
 *
 * Guardrails (Layers 1–5) are applied around the NLLB upstream call:
 * - L1/L2/L3 preflight and the circuit-breaker check come from
 *   `runTranslateGuardrails`. That helper's DeepL-shaped `hardenedBody`
 *   is intentionally ignored here; `callTranslateProvider` builds its own
 *   provider-specific Gradio payload from the already-sanitized text and
 *   the FLORES-200 target code.
 * - L4 uses a minimal NLLB-appropriate output check (non-empty string).
 *   PII is *detected* in the translated output for observability but never
 *   blocks the response — the translate route exists specifically to help
 *   users read documents that contain sensitive data (immigration forms,
 *   benefits letters, court filings, medical bills). Refusing to return a
 *   translation because it contains an SSN that the user can already see
 *   in their original document is the failure mode, not a safeguard.
 * - L5 fallbacks use `translateFallback` / `internalErrorFallback`.
 */

/** Long timeout to absorb HF cold starts; matches TTS scale. */
const TRANSLATE_TIMEOUT_MS = 180_000

function resolveTranslateUrl(): string | null {
  const explicit = process.env.HF_TRANSLATE_SPACE_URL?.trim()
  return explicit ? explicit : null
}

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
      internalErrorFallback({
        route: ROUTE,
        reason: 'Failed to parse request body as JSON',
      })
    )
  }

  // ── Layers 1–3 + circuit breaker preflight ────────────────────────────────
  const pre = runTranslateGuardrails(rawBody, ROUTE)
  if (!pre.ok) return NextResponse.json(pre.response, { status: pre.status })

  const { sanitizedText, targetLang, circuitBreaker } = pre.value

  // English short-circuit: no upstream call, no cold start.
  if (targetLang === 'en') {
    circuitBreaker.onSuccess()
    return NextResponse.json({ translatedText: sanitizedText })
  }

  const tgtLang = getNllbTargetCode(targetLang)
  if (!tgtLang) {
    // Should never happen — TRANSLATE_SUPPORTED_LANGS and APP_TO_NLLB_TARGET
    // currently cover the same keys — but fail closed if they ever drift.
    circuitBreaker.onFailure()
    guardrailLog('error', {
      route: ROUTE,
      layer: 'fallback',
      action: 'reject',
      reason: 'No NLLB target code for whitelisted targetLang',
      meta: { targetLang },
    })
    return fallbackResponse(
      translateFallback({
        inputLength: sanitizedText.length,
        reason: 'service-not-configured',
      })
    )
  }

  const url = resolveTranslateUrl()
  if (!url) {
    circuitBreaker.onFailure()
    guardrailLog('error', {
      route: ROUTE,
      layer: 'fallback',
      action: 'reject',
      reason: 'HF_TRANSLATE_SPACE_URL is not configured',
    })
    return fallbackResponse(
      translateFallback({
        inputLength: sanitizedText.length,
        reason: 'service-not-configured',
      })
    )
  }

  const hfToken = process.env.HF_TOKEN?.trim() || undefined

  // ── Upstream call (NLLB via HF Gradio Space) ──────────────────────────────
  let translatedText: string
  try {
    translatedText = await callTranslateProvider({
      text: sanitizedText,
      tgtLang,
      url,
      hfToken,
      timeoutMs: TRANSLATE_TIMEOUT_MS,
    })
    circuitBreaker.onSuccess()
  } catch (err) {
    circuitBreaker.onFailure()

    if (err instanceof TranslateProviderError) {
      if (err.kind === 'upstream_http_error') {
        // Log status + short snippet only; never tokens or full user text.
        console.error(
          'NLLB translate upstream error:',
          err.status,
          err.snippet ?? ''
        )
      }
      guardrailLog('error', {
        route: ROUTE,
        layer: 'fallback',
        action: 'reject',
        reason: 'NLLB translate provider threw TranslateProviderError',
        meta: { kind: err.kind, status: err.status },
      })
    } else {
      console.error('NLLB translate unexpected error')
      guardrailLog('error', {
        route: ROUTE,
        layer: 'fallback',
        action: 'reject',
        reason: 'callTranslateProvider threw an unexpected error',
        meta: {
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
    }

    return fallbackResponse(
      translateFallback({ inputLength: sanitizedText.length })
    )
  }

  // ── Layer 4: Output validation (NLLB-shaped) ─────────────────────────────
  // NLLB returns a plain translated string (no detected_source_language),
  // so the DeepL-specific `validateTranslateOutput` does not apply. Enforce
  // non-empty output + output PII re-detection here.
  if (!translatedText || translatedText.trim() === '') {
    guardrailLog('error', {
      route: ROUTE,
      layer: 'output-validation',
      action: 'reject',
      reason: 'NLLB returned an empty translation',
    })
    return fallbackResponse(
      translateFallback({ inputLength: sanitizedText.length })
    )
  }

  // Detect-only PII observability on the translated output. Never blocks —
  // see the file-level docstring for rationale. We log the categories
  // (no values) so ops can see how often translations contain sensitive
  // data without it ever turning into a 4xx for the user.
  const outputPiiMatches = detectPii(translatedText)
  if (outputPiiMatches.length > 0) {
    logWarn(
      ROUTE,
      'output-validation',
      'PII detected in translated output — passing through (translate route policy)',
      {
        outputLength: translatedText.length,
        detectedTypes: outputPiiMatches.map((m) => m.type),
      }
    )
  }

  logPass(
    ROUTE,
    'output-validation',
    'Translate output passed all validation checks',
    {
      inputLength: sanitizedText.length,
      outputLength: translatedText.length,
      targetLang,
    }
  )

  // Evaluation hook (`lib/evaluate.ts`): optional LangSmith run `evaluation-translate`.
  // Fire-and-forget; gated by EVALUATIONS_ENABLED + LangSmith env; NLLB model label is fixed here.
  evaluateAsync({
    input: sanitizedText,
    output: translatedText,
    model: 'nllb-hf-gradio',
    feature: 'translate',
    metadata: { targetLang },
  })
  return NextResponse.json({ translatedText })
}
