/**
 * Non-streaming OpenAI-compatible chat call to the Hugging Face Inference
 * Providers router (same contract as `/api/summarize` and the Ask legacy path).
 * Used when dedicated HF Inference Endpoints are not configured.
 */

const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1'
const DEFAULT_MODEL = 'meta-llama/Llama-3.1-8B-Instruct:cheapest'

export class HfRouterChatError extends Error {
  readonly status?: number
  readonly snippet?: string

  constructor(
    message: string,
    opts: { status?: number; snippet?: string; cause?: unknown } = {}
  ) {
    super(message)
    this.name = 'HfRouterChatError'
    this.status = opts.status
    this.snippet = opts.snippet
    if (opts.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = opts.cause
    }
  }
}

export interface HfRouterChatCompletionInput {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** Defaults to `HF_ASK_MODEL` pattern — must be valid on the router. */
  model?: string
  /** Defaults to `https://router.huggingface.co/v1` (same as Ask). */
  baseUrl?: string
  hfToken: string
  timeoutMs: number
  temperature?: number
  fetchImpl?: typeof fetch
}

/**
 * POST `{baseUrl}/chat/completions` and return assistant message text.
 */
export async function hfRouterChatCompletion(
  input: HfRouterChatCompletionInput
): Promise<string> {
  const {
    messages,
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    hfToken,
    timeoutMs,
    temperature = 0.2,
    fetchImpl = fetch,
  } = input

  const base = baseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: model.trim() || DEFAULT_MODEL,
        messages,
        temperature,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HfRouterChatError('HF router chat request aborted (timeout)', {
        cause: err,
      })
    }
    throw new HfRouterChatError('HF router chat request failed before response', {
      cause: err,
    })
  }
  clearTimeout(timeoutId)

  const raw = await res.text()
  let data: {
    choices?: { message?: { content?: string } }[]
    error?: unknown
    message?: unknown
  }
  try {
    data = JSON.parse(raw) as typeof data
  } catch (err) {
    throw new HfRouterChatError('HF router returned non-JSON response', {
      status: res.status,
      snippet: raw.slice(0, 200),
      cause: err,
    })
  }

  if (!res.ok) {
    const detail =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : raw.slice(0, 200)
    throw new HfRouterChatError(`HF router returned HTTP ${res.status}`, {
      status: res.status,
      snippet: detail,
    })
  }

  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    const snippet =
      typeof data.error === 'string'
        ? data.error.slice(0, 200)
        : raw.slice(0, 200)
    throw new HfRouterChatError(
      'HF router response missing assistant message content',
      { status: res.status, snippet }
    )
  }

  return content.trim()
}
