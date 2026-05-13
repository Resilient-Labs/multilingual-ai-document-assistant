import { NextResponse } from 'next/server'
import { evaluateAsync } from '@/lib/evaluate'
import { TranslateProviderError } from '@/lib/translation/callTranslateProvider'
import { callHfInferenceTranslateProvider } from '@/lib/translation/callHfInferenceProvider'
import { callHfPipelineTranslateProvider } from '@/lib/translation/callHfPipelineProvider'
import {
  runTranslateGuardrails,
  translateFallback,
  internalErrorFallback,
  guardrailLog,
  logPass,
  logWarn,
  type GuardrailResult,
} from '@/lib/guardrails'

const ROUTE = '/api/translate'

/**
 * Two upstream providers are supported, dispatched at request time by env.
 * Priority order, top wins:
 *
 *   1. `HF_TRANSLATE_ENDPOINT_URL` — a dedicated HF Inference Endpoint
 *      hosting a stock translation pipeline (NLLB-200 / M2M-100 / etc.).
 *      Single POST `{"inputs": "<text>", "parameters": {"src_lang": ..., "tgt_lang": ...}}`
 *      → `[{"translation_text": "..."}]`. **Preferred** for translate
 *      because the model is purpose-built for the task (better quality
 *      and lower latency than prompting an instruction-tuned chat
 *      model). Implementation in
 *      `lib/translation/callHfPipelineProvider`.
 *   2. `HF_INFERENCE_ENDPOINT_URL` — a dedicated HF Inference Endpoint
 *      hosting a chat model. Accepts the standard
 *      `{"inputs": {"messages": [...]}}` chat shape and returns
 *      `{"generated_text": "..."}`. Used when the same endpoint serves
 *      ask + safety + translate; we prompt the model to translate.
 *      Implementation in `lib/translation/callHfInferenceProvider`.
 *
 * Both providers throw the same `TranslateProviderError` discriminated
 * union, so the route's error mapping below does not need to know which
 * provider ran. Source language is fixed to English per product
 * requirement; target codes come from `APP_TO_NLLB_TARGET` (single
 * source of truth with the translate UI). `HF_TOKEN` is optional for
 * either provider and only forwarded as `Authorization: Bearer …` when
 * set.
 *
 * Guardrails (Layers 1–5) are applied around the upstream call:
 * - L1/L2/L3 preflight and the circuit-breaker check come from
 *   `runTranslateGuardrails`. That helper's DeepL-shaped `hardenedBody`
 *   is intentionally ignored here; each provider builds its own
 *   provider-specific payload from the already-sanitized text and the
 *   resolved target code.
 * - L4 uses a minimal NLLB-appropriate output check (non-empty string).
 *   Output PII heuristics are not applied: translated document text still
 *   contains phones, emails, and ID-like numbers by design (same rationale as
 *   skipping input PII in `runTranslateGuardrails`).
 * - L5 fallbacks use `translateFallback` / `internalErrorFallback`.
 */

/** Long timeout to absorb HF cold starts; matches TTS scale. */
const TRANSLATE_TIMEOUT_MS = 180_000

interface ResolvedTranslateProvider {
  /** Which backend to call. */
  kind: 'hf-translate-endpoint' | 'hf-inference-endpoint'
  /** Provider base URL (no trailing slash assumptions). */
  url: string
}

/**
 * Decide which translate provider to use based on env. Priority order:
 *   1. `HF_TRANSLATE_ENDPOINT_URL` (dedicated translation pipeline) —
 *      preferred because the model is purpose-built for translation.
 *   2. `HF_INFERENCE_ENDPOINT_URL` (chat model, prompted to translate).
 *
 * Returns `null` only when neither is configured (route returns 503 via
 * `translateFallback`).
 */
function resolveTranslateProvider(): ResolvedTranslateProvider | null {
  const pipeline = process.env.HF_TRANSLATE_ENDPOINT_URL?.trim()
  if (pipeline) return { kind: 'hf-translate-endpoint', url: pipeline }
  const inference = process.env.HF_INFERENCE_ENDPOINT_URL?.trim()
  if (inference) return { kind: 'hf-inference-endpoint', url: inference }
  return null
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

  const provider = resolveTranslateProvider()
  if (!provider) {
    circuitBreaker.onFailure()
    guardrailLog('error', {
      route: ROUTE,
      layer: 'fallback',
      action: 'reject',
      reason:
        'No translate provider configured — set HF_TRANSLATE_ENDPOINT_URL or HF_INFERENCE_ENDPOINT_URL',
    })
    return fallbackResponse(
      translateFallback({
        inputLength: sanitizedText.length,
        reason: 'service-not-configured',
      })
    )
  }

  const hfToken = process.env.HF_TOKEN?.trim() || undefined

  // ── Upstream call ─────────────────────────────────────────────────────────
  let translatedText: string
  try {
    if (provider.kind === 'hf-translate-endpoint') {
      translatedText = await callHfPipelineTranslateProvider({
        text: sanitizedText,
        targetLang,
        url: provider.url,
        hfToken,
        timeoutMs: TRANSLATE_TIMEOUT_MS,
      })
    } else {
      translatedText = await callHfInferenceTranslateProvider({
        text: sanitizedText,
        targetLang,
        url: provider.url,
        hfToken,
        timeoutMs: TRANSLATE_TIMEOUT_MS,
      })
    }
    circuitBreaker.onSuccess()
  } catch (err) {
    circuitBreaker.onFailure()

    if (err instanceof TranslateProviderError) {
      if (err.kind === 'upstream_http_error') {
        // Log status + short snippet only; never tokens or full user text.
        console.error(
          `Translate upstream error (${provider.kind}):`,
          err.status,
          err.snippet ?? ''
        )
      }
      guardrailLog('error', {
        route: ROUTE,
        layer: 'fallback',
        action: 'reject',
        reason: 'Translate provider threw TranslateProviderError',
        meta: { provider: provider.kind, kind: err.kind, status: err.status },
      })
    } else {
      console.error(`Translate unexpected error (${provider.kind})`)
      guardrailLog('error', {
        route: ROUTE,
        layer: 'fallback',
        action: 'reject',
        reason: 'Translate provider threw an unexpected error',
        meta: {
          provider: provider.kind,
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
  // non-empty output only (no output PII scan — see module comment above).
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
  // Fire-and-forget; gated by EVALUATIONS_ENABLED + LangSmith env; the
  // model label reflects which provider actually answered so dataset
  // analysis can compare quality across the three backends.
  const evalModelLabel: Record<typeof provider.kind, string> = {
    'hf-translate-endpoint': 'hf-translate-pipeline',
    'hf-inference-endpoint': 'hf-inference-endpoint',
  }
  evaluateAsync({
    input: sanitizedText,
    output: translatedText,
    model: evalModelLabel[provider.kind],
    feature: 'translate',
    metadata: { targetLang, provider: provider.kind },
  })
  return NextResponse.json({ translatedText })
}
