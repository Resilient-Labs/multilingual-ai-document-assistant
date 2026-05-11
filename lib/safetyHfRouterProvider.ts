import { hfRouterChatCompletion, HfRouterChatError } from '@/lib/hfRouterChatCompletion'
import { SafetyInferenceProviderError } from '@/lib/safetyHfInferenceProvider'

export interface CallHfRouterSafetyInput {
  systemPrompt: string
  userContent: string
  hfToken: string
  timeoutMs: number
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
}

function mapError(err: unknown): SafetyInferenceProviderError {
  if (err instanceof HfRouterChatError) {
    return new SafetyInferenceProviderError(err.message, {
      status: err.status,
      snippet: err.snippet,
      cause: err,
    })
  }
  return new SafetyInferenceProviderError(
    err instanceof Error ? err.message : 'HF router safety call failed',
    { cause: err }
  )
}

/**
 * Safety analysis via HF Inference Providers router (OpenAI chat completions).
 * Same JSON-in-text contract as the dedicated inference endpoint path.
 */
export async function callHfRouterSafetyProvider(
  input: CallHfRouterSafetyInput
): Promise<string> {
  const {
    systemPrompt,
    userContent,
    hfToken,
    timeoutMs,
    baseUrl,
    model,
    fetchImpl,
  } = input

  try {
    return await hfRouterChatCompletion({
      hfToken,
      timeoutMs,
      baseUrl,
      model,
      fetchImpl,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    })
  } catch (err) {
    throw mapError(err)
  }
}
