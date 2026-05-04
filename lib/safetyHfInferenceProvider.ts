/**
 * Talks to a Hugging Face *Inference Endpoint* whose deployed handler accepts
 * the standard `{"inputs": {"messages": [...]}}` chat shape and returns
 * `{"generated_text": "..."}`. Used by `/api/safety` when
 * `HF_INFERENCE_ENDPOINT_URL` is set.
 *
 * Returns the raw `generated_text` string as-is. The route is responsible
 * for stripping fenced code blocks / surrounding prose and parsing the
 * payload as JSON, mirroring how it already treats OpenRouter responses
 * (`extractJsonObjectString` + `JSON.parse`).
 *
 * Mirrors the structure of `lib/askHfInferenceProvider.ts`. We keep one
 * file per route consumer because each route's failure-mode contract is
 * different (translate maps to `TranslateProviderError`, ask returns
 * plain text, safety needs the raw string for downstream parsing).
 */

export interface CallHfInferenceSafetyInput {
  /**
   * Endpoint base URL — e.g.
   * `https://v2zimtjwdk7jj12o.us-east-1.aws.endpoints.huggingface.cloud`.
   * The helper does not append any path beyond `/`.
   */
  url: string
  /** Full system prompt loaded from `app/api/safety/system-prompt.md`. */
  systemPrompt: string
  /** User content (document text plus optional detected-fields block). */
  userContent: string
  /** Optional HF token; sent as `Authorization: Bearer <token>` when present. */
  hfToken?: string
  /** Abort budget for the round-trip. Safety responses are slower than translate (model reasons more). */
  timeoutMs: number
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
}

interface HfInferenceResponseShape {
  generated_text?: unknown
  error?: unknown
}

export class SafetyInferenceProviderError extends Error {
  /** Upstream HTTP status when relevant (otherwise undefined). */
  readonly status?: number
  /** Short snippet from the upstream body for logging — never user data. */
  readonly snippet?: string

  constructor(
    message: string,
    opts: { status?: number; snippet?: string; cause?: unknown } = {}
  ) {
    super(message)
    this.name = 'SafetyInferenceProviderError'
    this.status = opts.status
    this.snippet = opts.snippet
    if (opts.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = opts.cause
    }
  }
}

/**
 * Calls the HF Inference Endpoint chat handler and returns the raw
 * `generated_text` string. Throws `SafetyInferenceProviderError` on any
 * failure mode; the safety route maps any thrown error to its existing
 * 502 `UPSTREAM_ERROR` response.
 */
export async function callHfInferenceSafetyProvider(
  input: CallHfInferenceSafetyInput
): Promise<string> {
  const { url, systemPrompt, userContent, hfToken, timeoutMs } = input
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
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
      throw new SafetyInferenceProviderError(
        'HF Inference Endpoint request aborted (timeout)',
        { cause: err }
      )
    }
    throw new SafetyInferenceProviderError(
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
    throw new SafetyInferenceProviderError(
      `HF Inference Endpoint returned HTTP ${res.status}`,
      { status: res.status, snippet }
    )
  }

  let body: HfInferenceResponseShape
  try {
    body = (await res.json()) as HfInferenceResponseShape
  } catch (err) {
    throw new SafetyInferenceProviderError(
      'HF Inference Endpoint returned non-JSON response',
      { cause: err }
    )
  }

  if (typeof body.generated_text !== 'string') {
    const errText = typeof body.error === 'string' ? body.error : ''
    throw new SafetyInferenceProviderError(
      'HF Inference Endpoint response missing generated_text field',
      { snippet: errText.slice(0, 200) }
    )
  }

  if (!body.generated_text.trim()) {
    throw new SafetyInferenceProviderError(
      'HF Inference Endpoint returned an empty safety response'
    )
  }
  return body.generated_text
}
