import {
  NLLB_SOURCE_ENGLISH,
} from '@/lib/translation/nllbLanguageMap'
import { extractTranslatedTextFromNllbResponse } from '@/lib/translation/parseNllbResponse'

/**
 * Kinds of failures surfaced by {@link callTranslateProvider}. Callers map each
 * kind to the appropriate HTTP status (e.g. `timeout` / `upstream_http_error`
 * / `invalid_response` / `empty_response` → 502, `network` → 503). Keeping the
 * discriminant here means the route layer does not need to sniff error names
 * or response shapes.
 */
export type TranslateProviderErrorKind =
  | 'timeout'
  | 'network'
  | 'upstream_http_error'
  | 'invalid_response'
  | 'empty_response'

export class TranslateProviderError extends Error {
  readonly kind: TranslateProviderErrorKind
  readonly status?: number
  readonly snippet?: string

  constructor(
    kind: TranslateProviderErrorKind,
    message: string,
    opts: { status?: number; snippet?: string; cause?: unknown } = {}
  ) {
    super(message)
    this.name = 'TranslateProviderError'
    this.kind = kind
    this.status = opts.status
    this.snippet = opts.snippet
    if (opts.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = opts.cause
    }
  }
}

export interface CallTranslateProviderInput {
  /** English-source text to translate. */
  text: string
  /** NLLB FLORES target tag, e.g. `spa_Latn`. Use {@link getNllbTargetCode}. */
  tgtLang: string
  /**
   * Base URL of the Gradio NLLB Space (e.g.
   * `https://resilient-coders-nllb-translator.hf.space`). The helper appends
   * `/gradio_api/call/translate` for the submit step and
   * `/gradio_api/call/translate/{event_id}` for the SSE collect step.
   */
  url: string
  /** Optional HF token; only attached as Bearer when present (public Spaces work without one). */
  hfToken?: string
  /** Abort budget in ms for the full two-step round-trip (absorbs Space cold starts). */
  timeoutMs: number
  /**
   * Injection seam for tests. Defaults to the global `fetch`, which also
   * means `vi.stubGlobal('fetch', …)` keeps working unchanged.
   */
  fetchImpl?: typeof fetch
}

/**
 * Calls the NLLB translation Gradio Space using its two-step call protocol and
 * returns the translated string, or throws a {@link TranslateProviderError}
 * whose `kind` tells the caller exactly which failure mode occurred.
 *
 * Protocol (see https://www.gradio.app/guides/querying-gradio-apps-with-curl):
 *   1. `POST {base}/gradio_api/call/translate` with
 *      `{"data":[text, src_lang, tgt_lang]}` → `{event_id}`.
 *   2. `GET  {base}/gradio_api/call/translate/{event_id}` as SSE; the
 *      `event: complete` frame carries `data: ["<translated>"]`.
 *
 * A single {@link AbortController} bounds the whole round-trip against
 * `timeoutMs`. Never logs the user text or bearer token.
 */
export async function callTranslateProvider(
  input: CallTranslateProviderInput
): Promise<string> {
  const { text, tgtLang, url, hfToken, timeoutMs } = input
  const fetchImpl = input.fetchImpl ?? fetch

  const base = url.replace(/\/+$/, '')
  const submitUrl = `${base}/gradio_api/call/translate`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const submitHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (hfToken) {
    submitHeaders.Authorization = `Bearer ${hfToken}`
  }

  let submitRes: Response
  try {
    submitRes = await fetchImpl(submitUrl, {
      method: 'POST',
      headers: submitHeaders,
      body: JSON.stringify({ data: [text, NLLB_SOURCE_ENGLISH, tgtLang] }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TranslateProviderError(
        'timeout',
        'Translation request aborted (timeout)',
        { cause: err }
      )
    }
    throw new TranslateProviderError(
      'network',
      'Translation request failed before reaching provider',
      { cause: err }
    )
  }

  if (!submitRes.ok) {
    clearTimeout(timeoutId)
    let snippet = ''
    try {
      snippet = (await submitRes.text()).slice(0, 200)
    } catch {
      // body already consumed / unreadable — ignore
    }
    throw new TranslateProviderError(
      'upstream_http_error',
      `Translation provider returned HTTP ${submitRes.status} on submit`,
      { status: submitRes.status, snippet: `POST: ${snippet}` }
    )
  }

  let eventId: string | undefined
  try {
    const submitBody = (await submitRes.json()) as { event_id?: unknown }
    if (typeof submitBody?.event_id === 'string') {
      eventId = submitBody.event_id
    }
  } catch (err) {
    clearTimeout(timeoutId)
    throw new TranslateProviderError(
      'invalid_response',
      'Gradio submit returned non-JSON response',
      { cause: err }
    )
  }
  if (!eventId) {
    clearTimeout(timeoutId)
    throw new TranslateProviderError(
      'invalid_response',
      'Gradio submit response missing event_id'
    )
  }

  const pollHeaders: Record<string, string> = {
    Accept: 'text/event-stream',
  }
  if (hfToken) {
    pollHeaders.Authorization = `Bearer ${hfToken}`
  }

  let pollRes: Response
  try {
    pollRes = await fetchImpl(`${base}/gradio_api/call/translate/${eventId}`, {
      method: 'GET',
      headers: pollHeaders,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TranslateProviderError(
        'timeout',
        'Translation request aborted (timeout)',
        { cause: err }
      )
    }
    throw new TranslateProviderError(
      'network',
      'Translation collect request failed before reaching provider',
      { cause: err }
    )
  }
  clearTimeout(timeoutId)

  if (!pollRes.ok) {
    let snippet = ''
    try {
      snippet = (await pollRes.text()).slice(0, 200)
    } catch {
      // body already consumed / unreadable — ignore
    }
    throw new TranslateProviderError(
      'upstream_http_error',
      `Translation provider returned HTTP ${pollRes.status} on collect`,
      { status: pollRes.status, snippet: `SSE: ${snippet}` }
    )
  }

  let body: string
  try {
    body = await pollRes.text()
  } catch (err) {
    throw new TranslateProviderError(
      'invalid_response',
      'Gradio collect stream unreadable',
      { cause: err }
    )
  }

  // Split into SSE frames (blank-line separated) and walk them,
  // taking the payload that immediately follows `event: complete`.
  // Treat `event: error` as an upstream provider error, not a
  // contract violation, so the route still maps it to 502 with a
  // useful snippet.
  const frames = body.split(/\r?\n\r?\n/)
  let completeDataRaw: string | null = null
  let errorDataRaw: string | null = null
  for (const frame of frames) {
    let eventName: string | null = null
    let dataLine: string | null = null
    for (const rawLine of frame.split(/\r?\n/)) {
      const line = rawLine.trimEnd()
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:') && dataLine === null) dataLine = line.slice(5).trim()
    }
    if (!dataLine) continue
    if (eventName === 'complete') {
      completeDataRaw = dataLine
      break
    }
    if (eventName === 'error' && errorDataRaw === null) errorDataRaw = dataLine
  }

  if (errorDataRaw !== null && completeDataRaw === null) {
    throw new TranslateProviderError(
      'upstream_http_error',
      'Gradio collect stream reported an error event',
      { snippet: `SSE error: ${errorDataRaw.slice(0, 180)}` }
    )
  }
  if (completeDataRaw === null) {
    throw new TranslateProviderError(
      'invalid_response',
      'Gradio collect response missing event: complete frame',
      { snippet: body.slice(0, 200) }
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(completeDataRaw)
  } catch (err) {
    throw new TranslateProviderError(
      'invalid_response',
      'Gradio collect complete frame was not valid JSON',
      { cause: err, snippet: completeDataRaw.slice(0, 200) }
    )
  }

  const translated = extractTranslatedTextFromNllbResponse(parsed)
  if (!translated) {
    throw new TranslateProviderError(
      'empty_response',
      'Translation provider returned an empty translation'
    )
  }
  return translated
}
