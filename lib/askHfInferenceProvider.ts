/**
 * Talks to a Hugging Face *Inference Endpoint* whose deployed handler accepts
 * the standard `{"inputs": {"messages": [...]}}` chat shape and returns
 * `{"generated_text": "..."}`. Used by `/api/ask` when
 * `HF_INFERENCE_ENDPOINT_URL` is set.
 *
 * Why this lives separately from `lib/translation/callHfInferenceProvider.ts`:
 *   - The translate provider throws `TranslateProviderError` and is
 *     consumed inside the translate-specific guardrail pipeline.
 *   - The ask provider returns plain text (or throws a generic Error)
 *     because the ask route's existing error path uses `console.error` +
 *     a `Question answering failed` 500 — keeping the helper Error-shape
 *     free avoids the route having to know about translate-specific
 *     classes.
 *
 * The endpoint is **non-streaming** (it ignores `stream: true`), so this
 * helper does a single POST and returns the full text. The caller (Ask
 * route) is responsible for wrapping the text in a UI message stream so
 * the existing `AskTab` reader keeps working unchanged.
 */

export interface CallHfInferenceAskInput {
  /**
   * Endpoint base URL — e.g.
   * `https://v2zimtjwdk7jj12o.us-east-1.aws.endpoints.huggingface.cloud`.
   * The helper does not append any path beyond `/`.
   */
  url: string
  /** Full system prompt (built by `buildSystemPrompt` in the Ask route). */
  systemPrompt: string
  /** Sanitized user question. */
  userQuestion: string
  /** Optional HF token; sent as `Authorization: Bearer <token>` when present. */
  hfToken?: string
  /** Abort budget for the whole round-trip. Endpoint cold starts can be slow. */
  timeoutMs: number
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
}

interface HfInferenceResponseShape {
  generated_text?: unknown
  error?: unknown
}

/**
 * Calls the HF Inference Endpoint chat handler and returns the full
 * answer text. Throws a plain `Error` on any failure mode; the Ask route
 * maps all such errors to the same generic 500 it already returns when
 * `streamText` blows up.
 */
export async function callHfInferenceAskProvider(
  input: CallHfInferenceAskInput
): Promise<string> {
  const { url, systemPrompt, userQuestion, hfToken, timeoutMs } = input
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
        { role: 'user', content: userQuestion },
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
      throw new Error('HF Inference Endpoint request aborted (timeout)')
    }
    throw new Error(
      `HF Inference Endpoint request failed: ${err instanceof Error ? err.message : String(err)}`
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
    throw new Error(
      `HF Inference Endpoint returned HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`
    )
  }

  let body: HfInferenceResponseShape
  try {
    body = (await res.json()) as HfInferenceResponseShape
  } catch (err) {
    throw new Error(
      `HF Inference Endpoint returned non-JSON response: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (typeof body.generated_text !== 'string') {
    const errText = typeof body.error === 'string' ? body.error : ''
    throw new Error(
      `HF Inference Endpoint response missing generated_text${errText ? `: ${errText.slice(0, 200)}` : ''}`
    )
  }

  const text = body.generated_text
  if (!text.trim()) {
    throw new Error('HF Inference Endpoint returned an empty answer')
  }
  return text
}
