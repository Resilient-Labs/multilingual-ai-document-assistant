/**
 * Shared error type for `/api/translate` upstream providers.
 *
 * Historically this file also contained `callTranslateProvider`, an
 * implementation of the public NLLB Gradio Space's two-step call
 * protocol. That provider was retired when the team moved translation to
 * dedicated HF Inference Endpoints; the file is kept (rather than
 * deleted) so existing imports of `TranslateProviderError` from
 * `@/lib/translation/callTranslateProvider` keep resolving without a
 * sweeping import update.
 *
 * Both active providers (`callHfPipelineTranslateProvider` and
 * `callHfInferenceTranslateProvider`) throw this same class so the
 * route's error mapping does not need to discriminate by helper —
 * `kind` plus optional `status` / `snippet` tell the caller exactly
 * which failure mode occurred.
 */

/**
 * Kinds of failures surfaced by the translate providers. Callers map
 * each kind to the appropriate HTTP status (e.g. `timeout` /
 * `upstream_http_error` / `invalid_response` / `empty_response` → 502,
 * `network` → 503).
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
