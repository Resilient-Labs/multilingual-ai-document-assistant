import { hfRouterChatCompletion, HfRouterChatError } from '@/lib/hfRouterChatCompletion'
import { TranslateProviderError } from '@/lib/translation/callTranslateProvider'
import {
  buildTranslateSystemPrompt,
  stripWrappingQuotes,
} from '@/lib/translation/callHfInferenceProvider'

export interface CallHfRouterTranslateInput {
  text: string
  targetLang: string
  hfToken: string
  timeoutMs: number
  /** Same defaults as Ask — `HF_ASK_BASE_URL` / `HF_ASK_MODEL`. */
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
}

function mapRouterError(err: unknown): TranslateProviderError {
  if (err instanceof HfRouterChatError) {
    if (err.message.includes('timeout')) {
      return new TranslateProviderError('timeout', err.message, { cause: err })
    }
    if (typeof err.status === 'number' && err.status > 0) {
      return new TranslateProviderError(
        'upstream_http_error',
        `HF router returned HTTP ${err.status}`,
        { status: err.status, snippet: err.snippet, cause: err }
      )
    }
    if (err.message.includes('non-JSON')) {
      return new TranslateProviderError(
        'invalid_response',
        err.message,
        { snippet: err.snippet, cause: err }
      )
    }
    if (err.message.includes('missing assistant')) {
      return new TranslateProviderError(
        'empty_response',
        err.message,
        { snippet: err.snippet, cause: err }
      )
    }
    return new TranslateProviderError('network', err.message, {
      snippet: err.snippet,
      cause: err,
    })
  }
  return new TranslateProviderError(
    'network',
    err instanceof Error ? err.message : 'HF router translate failed',
    { cause: err }
  )
}

/**
 * OpenAI-compatible router translate — used when dedicated pipeline / inference
 * URLs are unset but `HF_TOKEN` is configured.
 */
export async function callHfRouterTranslateProvider(
  input: CallHfRouterTranslateInput
): Promise<string> {
  const {
    text,
    targetLang,
    hfToken,
    timeoutMs,
    baseUrl,
    model,
    fetchImpl,
  } = input

  try {
    const raw = await hfRouterChatCompletion({
      hfToken,
      timeoutMs,
      baseUrl,
      model,
      fetchImpl,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildTranslateSystemPrompt(targetLang) },
        { role: 'user', content: text },
      ],
    })
    const out = stripWrappingQuotes(raw)
    if (!out.trim()) {
      throw new TranslateProviderError(
        'empty_response',
        'HF router returned an empty translation'
      )
    }
    return out
  } catch (err) {
    if (err instanceof TranslateProviderError) throw err
    throw mapRouterError(err)
  }
}
