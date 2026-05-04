import {
  NLLB_SOURCE_ENGLISH,
  getNllbTargetCode,
} from '@/lib/translation/nllbLanguageMap'
import { TranslateProviderError } from '@/lib/translation/callTranslateProvider'

/**
 * Calls a Hugging Face *Inference Endpoint* whose deployed handler is a
 * stock translation pipeline (e.g. NLLB-200, M2M-100, Marian). These
 * endpoints accept the standard text-translation pipeline contract:
 *
 *     POST  /
 *     Body  {"inputs": "<text>", "parameters": {"src_lang": "<flores>", "tgt_lang": "<flores>"}}
 *     200   [{"translation_text": "<translated>"}]
 *
 * Used by `/api/translate` when `HF_TRANSLATE_ENDPOINT_URL` is set. This
 * is the **preferred** provider for translation because:
 *   - The model is purpose-built for translation (better quality + lower
 *     latency than prompting an instruction-tuned chat model).
 *   - It accepts FLORES-200 codes directly, so we forward the same
 *     `tgtLang` value the legacy Gradio `callTranslateProvider` uses.
 *
 * Two providers are supported by `app/api/translate/route.ts`:
 *
 *   1. `HF_TRANSLATE_ENDPOINT_URL` (this helper, top priority).
 *   2. `HF_INFERENCE_ENDPOINT_URL` (chat-shaped, prompted to translate).
 *
 * Throws `TranslateProviderError` so the route's error mapping works
 * without a per-helper code path.
 */

export interface CallHfPipelineTranslateInput {
  /** English-source text to translate (already sanitized by L1 guardrails). */
  text: string
  /**
   * App-level target language code (e.g. `"es"`, `"zh-TW"`). Resolved to
   * a FLORES-200 tag via `APP_TO_NLLB_TARGET` before being sent.
   */
  targetLang: string
  /**
   * Endpoint base URL — e.g.
   * `https://xizvmmfxd7pswk1z.eu-west-1.aws.endpoints.huggingface.cloud`.
   * The helper does not append any path beyond `/`.
   */
  url: string
  /** Optional HF token; sent as `Authorization: Bearer <token>` when present. */
  hfToken?: string
  /** Abort budget for the round-trip. Pipeline endpoints respond in ~1–3s. */
  timeoutMs: number
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
}

interface PipelineResponseEntry {
  translation_text?: unknown
}

/**
 * Calls the HF translation-pipeline endpoint and returns the translated
 * string. Errors are mapped to `TranslateProviderError` for parity with
 * the Gradio + chat-shape providers.
 */
export async function callHfPipelineTranslateProvider(
  input: CallHfPipelineTranslateInput
): Promise<string> {
  const { text, targetLang, url, hfToken, timeoutMs } = input
  const fetchImpl = input.fetchImpl ?? fetch

  const tgtLang = getNllbTargetCode(targetLang)
  if (!tgtLang) {
    // Should never happen — TRANSLATE_SUPPORTED_LANGS and
    // APP_TO_NLLB_TARGET cover the same keys — but fail closed if they
    // ever drift.
    throw new TranslateProviderError(
      'invalid_response',
      `No FLORES-200 target code for language: ${targetLang}`
    )
  }

  const base = url.replace(/\/+$/, '')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (hfToken) headers.Authorization = `Bearer ${hfToken}`

  const payload = {
    inputs: text,
    parameters: {
      src_lang: NLLB_SOURCE_ENGLISH,
      tgt_lang: tgtLang,
    },
  }

  let res: Response
  try {
    res = await fetchImpl(`${base}/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TranslateProviderError(
        'timeout',
        'HF translate-pipeline request aborted (timeout)',
        { cause: err }
      )
    }
    throw new TranslateProviderError(
      'network',
      'HF translate-pipeline request failed before reaching provider',
      { cause: err }
    )
  }
  clearTimeout(timeoutId)

  if (!res.ok) {
    let snippet = ''
    try {
      snippet = (await res.text()).slice(0, 200)
    } catch {
      // body already consumed / unreadable — ignore
    }
    throw new TranslateProviderError(
      'upstream_http_error',
      `HF translate-pipeline returned HTTP ${res.status}`,
      { status: res.status, snippet }
    )
  }

  let body: unknown
  try {
    body = await res.json()
  } catch (err) {
    throw new TranslateProviderError(
      'invalid_response',
      'HF translate-pipeline returned non-JSON response',
      { cause: err }
    )
  }

  // Pipeline endpoints return a single-element array of
  // `{translation_text: string}`, but defensively accept the bare object
  // shape too in case a custom handler unwraps it.
  let entry: PipelineResponseEntry | undefined
  if (Array.isArray(body) && body.length > 0) {
    entry = body[0] as PipelineResponseEntry
  } else if (body && typeof body === 'object') {
    entry = body as PipelineResponseEntry
  }

  if (!entry || typeof entry.translation_text !== 'string') {
    throw new TranslateProviderError(
      'invalid_response',
      'HF translate-pipeline response missing translation_text field'
    )
  }

  const translated = entry.translation_text.trim()
  if (!translated) {
    throw new TranslateProviderError(
      'empty_response',
      'HF translate-pipeline returned an empty translation'
    )
  }
  return translated
}
