import { TranslateProviderError } from '@/lib/translation/callTranslateProvider'

/**
 * Calls a Hugging Face *Inference Endpoint* whose deployed handler accepts the
 * standard `{"inputs": {"messages": [...]}}` chat shape and returns
 * `{"generated_text": "..."}`. This is the protocol used by the team's
 * dedicated endpoint at
 * `https://<id>.us-east-1.aws.endpoints.huggingface.cloud/`.
 *
 * Why a separate file instead of extending `callTranslateProvider`:
 * the existing provider speaks Gradio's two-step `/gradio_api/call/...`
 * SSE protocol, which is structurally different from this endpoint's
 * single-shot JSON contract. Splitting them keeps each helper readable
 * and lets the route layer dispatch by env var.
 *
 * The helper deliberately throws the same `TranslateProviderError`
 * subclasses as the Gradio path so the route handler does not need a
 * second error-mapping branch — `kind` plus optional `status` / `snippet`
 * tell the caller exactly which failure mode occurred.
 */

/**
 * Human-readable language labels used to build the translation system
 * prompt. Keys mirror `APP_TO_NLLB_TARGET` so callers can pass the same
 * `targetLang` they would pass to the NLLB path. Any code not in this
 * map will be sent as the bare string ("Translate from English to ja.")
 * which most modern instruction-tuned models still handle correctly,
 * but adding a label is preferred when introducing a new language.
 */
const TARGET_LANG_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  tr: 'Turkish',
  vi: 'Vietnamese',
}

export interface CallHfInferenceTranslateInput {
  /** English-source text to translate. Already sanitized by the guardrail layer. */
  text: string
  /**
   * App-level target language code (e.g. `"es"`, `"zh-TW"`). Matches the
   * keys in `APP_TO_NLLB_TARGET` / `TRANSLATE_SUPPORTED_LANGS`.
   */
  targetLang: string
  /**
   * Endpoint base URL — e.g.
   * `https://v2zimtjwdk7jj12o.us-east-1.aws.endpoints.huggingface.cloud`.
   * The helper does not append any path beyond `/`.
   */
  url: string
  /** Optional HF token; sent as `Authorization: Bearer <token>` when present. */
  hfToken?: string
  /** Abort budget for the whole round-trip. Endpoint cold starts can be slow. */
  timeoutMs: number
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
}

/**
 * Build the system prompt that constrains the model to "output only the
 * translation". The phrasing is deliberately strict because instruction-
 * tuned models love to add "Sure! Here's the translation:" preambles
 * which would corrupt the output the route streams back to the client.
 */
/** Exported for the HF router translate fallback (`callHfRouterTranslateProvider`). */
export function buildTranslateSystemPrompt(targetLang: string): string {
  const label = TARGET_LANG_LABELS[targetLang] ?? targetLang
  return [
    `You are a professional translator. Translate the user's message from English into ${label}.`,
    'Output ONLY the translated text.',
    'Do NOT include quotation marks, source language, explanations, preambles, or trailing notes.',
    'Preserve line breaks, lists, and formatting. Preserve names, numbers, dates, currency, and addresses verbatim.',
  ].join(' ')
}

/**
 * Strip wrapping quotes (straight or curly) the model occasionally adds
 * despite the system prompt. Conservative — only removes a single
 * matching pair at the very ends, so legitimate quoted content inside
 * the document is preserved.
 */
export function stripWrappingQuotes(s: string): string {
  const trimmed = s.trim()
  if (trimmed.length < 2) return trimmed
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['\u201C', '\u201D'],
    ['\u2018', '\u2019'],
  ]
  for (const [open, close] of pairs) {
    if (first === open && last === close) {
      return trimmed.slice(1, -1).trim()
    }
  }
  return trimmed
}

interface HfInferenceResponseShape {
  generated_text?: unknown
  error?: unknown
}

/**
 * Calls the HF Inference Endpoint chat handler and returns the translated
 * text. Errors are mapped to `TranslateProviderError` so the route layer
 * can reuse its existing 502 / 503 mapping without a second code path.
 */
export async function callHfInferenceTranslateProvider(
  input: CallHfInferenceTranslateInput
): Promise<string> {
  const { text, targetLang, url, hfToken, timeoutMs } = input
  const fetchImpl = input.fetchImpl ?? fetch

  const base = url.replace(/\/+$/, '')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (hfToken) headers.Authorization = `Bearer ${hfToken}`

  const payload = {
    inputs: {
      messages: [
        { role: 'system', content: buildTranslateSystemPrompt(targetLang) },
        { role: 'user', content: text },
      ],
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
        'HF Inference Endpoint request aborted (timeout)',
        { cause: err }
      )
    }
    throw new TranslateProviderError(
      'network',
      'HF Inference Endpoint request failed before reaching provider',
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
      `HF Inference Endpoint returned HTTP ${res.status}`,
      { status: res.status, snippet }
    )
  }

  let body: HfInferenceResponseShape
  try {
    body = (await res.json()) as HfInferenceResponseShape
  } catch (err) {
    throw new TranslateProviderError(
      'invalid_response',
      'HF Inference Endpoint returned non-JSON response',
      { cause: err }
    )
  }

  if (typeof body.generated_text !== 'string') {
    const snippet =
      typeof body.error === 'string' ? body.error.slice(0, 200) : ''
    throw new TranslateProviderError(
      'invalid_response',
      'HF Inference Endpoint response missing generated_text field',
      { snippet }
    )
  }

  const cleaned = stripWrappingQuotes(body.generated_text)
  if (!cleaned) {
    throw new TranslateProviderError(
      'empty_response',
      'HF Inference Endpoint returned an empty translation'
    )
  }
  return cleaned
}
