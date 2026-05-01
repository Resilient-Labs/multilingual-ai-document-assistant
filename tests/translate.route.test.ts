import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/translate/route'
import { getCircuitBreaker } from '@/lib/guardrails/circuit-breaker'
import { extractTranslatedTextFromNllbResponse } from '@/lib/translation/parseNllbResponse'

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/**
 * Default test Space base URL. After the Gradio Space migration
 * (`app/api/translate/route.ts` → `callTranslateProvider`), the route
 * reads `HF_TRANSLATE_SPACE_URL` as a *base* only — the helper appends
 * `/gradio_api/call/translate` on submit and
 * `/gradio_api/call/translate/{event_id}` on collect, so the value here
 * must not include those suffixes.
 */
const TEST_SPACE_URL = 'https://test.hf.space'

/** Submit-step payload: Gradio returns `{ event_id }` for the collect step. */
function submitResponse(eventId = 'evt_123'): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ event_id: eventId }),
    json: async () => ({ event_id: eventId }),
  } as unknown as Response
}

/** Collect-step SSE body; Gradio terminates with a single `event: complete` frame. */
function sseResponse(translated: string): Response {
  const body = `event: complete\ndata: ${JSON.stringify([translated])}\n\n`
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => {
      throw new SyntaxError('SSE body is not JSON')
    },
  } as unknown as Response
}

/**
 * Cold-start collect-step SSE body: on a fresh Space wake-up, Gradio
 * emits a `heartbeat` frame and one or more `generating` frames (each
 * with `data: null`) before the terminal `event: complete` frame. The
 * parser must skip the null data frames and only pick the payload that
 * follows `event: complete`.
 */
function coldStartSseResponse(translated: string): Response {
  const body =
    'event: heartbeat\ndata: null\n\n' +
    'event: generating\ndata: null\n\n' +
    `event: complete\ndata: ${JSON.stringify([translated])}\n\n`
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => {
      throw new SyntaxError('SSE body is not JSON')
    },
  } as unknown as Response
}

/**
 * Collect-step SSE body that terminates with `event: error` instead of
 * `event: complete` — the Space crashed / raised mid-stream. The helper
 * must surface this as an upstream error rather than a contract
 * violation so the route still maps it to 502.
 */
function errorSseResponse(msg: string): Response {
  const body =
    'event: heartbeat\ndata: null\n\n' +
    `event: error\ndata: ${JSON.stringify(msg)}\n\n`
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => {
      throw new SyntaxError('SSE body is not JSON')
    },
  } as unknown as Response
}

/** Generic text-body response, used for non-2xx and malformed-SSE cases. */
function textResponse(
  status: number,
  body: string,
  ok = status >= 200 && status < 300
): Response {
  return {
    ok,
    status,
    text: async () => body,
    json: async () => {
      try {
        return JSON.parse(body)
      } catch (err) {
        throw err instanceof Error
          ? err
          : new SyntaxError('Response body is not JSON')
      }
    },
  } as unknown as Response
}

describe('extractTranslatedTextFromNllbResponse', () => {
  it('reads translation_text object shape', () => {
    expect(
      extractTranslatedTextFromNllbResponse({ translation_text: 'Hola' })
    ).toBe('Hola')
  })

  it('reads legacy array shape', () => {
    expect(
      extractTranslatedTextFromNllbResponse([
        { translation_text: 'Bonjour' },
      ])
    ).toBe('Bonjour')
  })

  it('reads plain string', () => {
    expect(extractTranslatedTextFromNllbResponse('Hi')).toBe('Hi')
  })

  it('returns null for empty', () => {
    expect(extractTranslatedTextFromNllbResponse({})).toBeNull()
    expect(extractTranslatedTextFromNllbResponse('')).toBeNull()
    expect(extractTranslatedTextFromNllbResponse('   ')).toBeNull()
  })
})

/**
 * Route contract covered here matches `app/api/translate/route.ts` after
 * the Gradio NLLB Space migration (live Space:
 * `Resilient-Coders/nllb-translator`). The route delegates to
 * `callTranslateProvider`, which drives the Gradio two-step call protocol:
 *   1. `POST  {base}/gradio_api/call/translate`
 *      body `{"data":[text, "eng_Latn", tgt_lang]}` → `{ event_id }`.
 *   2. `GET   {base}/gradio_api/call/translate/{event_id}` as SSE;
 *      the `event: complete` frame carries `data: ["<translated>"]`.
 *
 * Env + auth:
 *   - `resolveTranslateUrl()` reads `HF_TRANSLATE_SPACE_URL` as the Space
 *     *base* URL only. Missing / whitespace-only ⇒ 503 before any upstream
 *     call. There is no router fallback and no `HF_TRANSLATE_MODEL`.
 *   - The Space is public, so `HF_TOKEN` is *optional*. When unset, no
 *     `Authorization` header is sent on either step. When set, the helper
 *     forwards `Authorization: Bearer <token>` on both the submit and
 *     collect requests so private Spaces / paid HF Inference Endpoints
 *     behind the same base URL remain a one-env-var rollback.
 *   - A single `AbortController` bounds the whole round-trip against
 *     `TRANSLATE_TIMEOUT_MS`. Provider failures and most thrown errors are
 *     surfaced via `translateFallback` (**503** + user-safe message, same as
 *     missing Space URL).
 */
const TRANSLATE_UNAVAILABLE =
  'The translation service is temporarily unavailable. Your text has been preserved — please try again in a moment.'

describe('POST /api/translate', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.HF_TRANSLATE_SPACE_URL = TEST_SPACE_URL
    vi.stubGlobal('fetch', fetchMock)
    // Isolate failures: consecutive 503s in this file trip the shared breaker.
    getCircuitBreaker('deepl').reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.HF_TOKEN
    delete process.env.HF_TRANSLATE_SPACE_URL
  })

  it('returns 422 when text is missing', async () => {
    const res = await POST(jsonRequest({ targetLang: 'es' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 when text is only whitespace', async () => {
    const res = await POST(jsonRequest({ text: '   \n\t', targetLang: 'es' }))
    expect(res.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 422 when targetLang is missing', async () => {
    const res = await POST(jsonRequest({ text: 'Hello' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 for unsupported targetLang', async () => {
    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'xx' }))
    expect(res.status).toBe(422)
    const j = (await res.json()) as { error?: string }
    // Rejected by Zod enum before domain `checkTranslateLang`.
    expect(j.error).toMatch(/targetLang must be one of:/)
  })

  it('returns original text for English target without calling fetch', async () => {
    const res = await POST(jsonRequest({ text: 'Hello world', targetLang: 'en' }))
    expect(res.status).toBe(200)
    const j = (await res.json()) as { translatedText?: string }
    expect(j.translatedText).toBe('Hello world')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 503 when HF_TRANSLATE_SPACE_URL is missing', async () => {
    delete process.env.HF_TRANSLATE_SPACE_URL
    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'es' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats whitespace-only HF_TRANSLATE_SPACE_URL as missing (503, no upstream call)', async () => {
    process.env.HF_TRANSLATE_SPACE_URL = '   '
    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'es' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns translatedText on provider success without HF_TOKEN (no Authorization header on either step)', async () => {
    // Space is public by default: unset HF_TOKEN must not break translation
    // and must not send an Authorization header upstream on *either* step.
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_123'))
      .mockImplementationOnce(async () => sseResponse('Hola'))

    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'es' }))
    expect(res.status).toBe(200)
    const j = (await res.json()) as { translatedText?: string }
    expect(j.translatedText).toBe('Hola')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // --- Step 1: POST /gradio_api/call/translate ---
    const submitCall = fetchMock.mock.calls[0]
    expect(submitCall[0]).toBe(`${TEST_SPACE_URL}/gradio_api/call/translate`)
    const submitInit = submitCall[1] as {
      method?: string
      headers?: Record<string, string>
      body?: string
    }
    expect(submitInit.method).toBe('POST')
    expect(submitInit.headers?.Authorization).toBeUndefined()
    expect(submitInit.headers?.['Content-Type']).toBe('application/json')
    const submitBody = JSON.parse(submitInit.body ?? '{}') as {
      data: unknown[]
    }
    // Positional Gradio payload: [text, src_lang, tgt_lang]. Source is
    // fixed to English per product rule.
    expect(submitBody.data).toEqual(['Hello', 'eng_Latn', 'spa_Latn'])
    // Guard against accidental extra fields (e.g. leaking user id / token).
    expect(Object.keys(submitBody).sort()).toEqual(['data'])

    // --- Step 2: GET /gradio_api/call/translate/{event_id} ---
    const pollCall = fetchMock.mock.calls[1]
    expect(pollCall[0]).toBe(
      `${TEST_SPACE_URL}/gradio_api/call/translate/evt_123`
    )
    const pollInit = pollCall[1] as {
      method?: string
      headers?: Record<string, string>
    }
    expect(pollInit.method).toBe('GET')
    expect(pollInit.headers?.Authorization).toBeUndefined()
  })

  it('forwards Authorization: Bearer <HF_TOKEN> on both steps when the token is set', async () => {
    // Token-present path covers the rollback case (private Space or paid
    // HF Inference Endpoint behind the same URL env var). Both the submit
    // and collect requests must carry the Bearer.
    process.env.HF_TOKEN = 'test-hf-token'
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_fr'))
      .mockImplementationOnce(async () => sseResponse('Bonjour'))

    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'fr' }))
    expect(res.status).toBe(200)
    const j = (await res.json()) as { translatedText?: string }
    expect(j.translatedText).toBe('Bonjour')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const submitInit = fetchMock.mock.calls[0][1] as {
      headers?: Record<string, string>
      body?: string
    }
    expect(submitInit.headers?.Authorization).toBe('Bearer test-hf-token')
    const submitBody = JSON.parse(submitInit.body ?? '{}') as {
      data: unknown[]
    }
    expect(submitBody.data).toEqual(['Hello', 'eng_Latn', 'fra_Latn'])

    const pollInit = fetchMock.mock.calls[1][1] as {
      headers?: Record<string, string>
    }
    expect(pollInit.headers?.Authorization).toBe('Bearer test-hf-token')
  })

  it('returns 503 when the submit step returns a non-2xx HTTP status', async () => {
    // Step-1 failure: Space temporarily unavailable / malformed request at
    // the Gradio API layer. The route uses translateFallback (503) for all
    // provider failures.
    fetchMock.mockImplementationOnce(async () =>
      textResponse(503, 'upstream unavailable')
    )
    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'de' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns 503 when the submit step returns no event_id (invalid JSON shape)', async () => {
    // Step-1 2xx but payload does not carry `event_id` — the helper
    // cannot proceed to collect. Maps to translateFallback (503).
    fetchMock.mockImplementationOnce(async () =>
      textResponse(200, JSON.stringify({ not_an_event_id: true }))
    )
    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'it' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns 503 when the collect step returns a malformed SSE body (no data frame)', async () => {
    // Step-2 2xx but the body has no `data:` line — Gradio contract
    // violated. Route surfaces translateFallback (503).
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_garbage'))
      .mockImplementationOnce(async () => textResponse(200, 'garbage\n'))

    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'it' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns translatedText on a cold-start SSE body with heartbeat and generating frames before complete', async () => {
    // Regression pin for the cold-start 502: on a fresh Space wake-up
    // Gradio prefixes the stream with `heartbeat` and `generating`
    // frames whose payload is literal `null`. The SSE walker must skip
    // those frames and only parse the payload attached to
    // `event: complete`, otherwise `data: null` is picked up and
    // `extractTranslatedTextFromNllbResponse(null)` → `empty_response`
    // → 502 even though the upstream translation succeeded.
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_cold'))
      .mockImplementationOnce(async () => coldStartSseResponse('Bonjour au monde'))

    const res = await POST(jsonRequest({ text: 'Hello world', targetLang: 'fr' }))
    expect(res.status).toBe(200)
    const j = (await res.json()) as { translatedText?: string }
    expect(j.translatedText).toBe('Bonjour au monde')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns 503 when the collect stream emits event: error before complete', async () => {
    // Space crashed / raised mid-stream. Gradio terminates the SSE with
    // `event: error` instead of `event: complete`. Route uses translateFallback.
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_err'))
      .mockImplementationOnce(async () => errorSseResponse('Space crashed'))

    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'de' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns 503 when the collect stream has only heartbeat frames (no complete frame)', async () => {
    // Stream ended without a terminal `event: complete` frame — e.g.
    // the connection dropped during cold-start. No usable payload → 503.
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_heartbeat_only'))
      .mockImplementationOnce(async () =>
        textResponse(200, 'event: heartbeat\ndata: null\n\n')
      )

    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'it' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns 503 when the collect step returns a non-2xx HTTP status', async () => {
    // Step-2 upstream HTTP error (e.g. event expired / Space worker died).
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_gone'))
      .mockImplementationOnce(async () => textResponse(500, 'poll failure'))

    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'de' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns 503 when the collect step returns an empty translation', async () => {
    // Step-2 well-formed SSE but `data: [""]` — route rejects after provider.
    fetchMock
      .mockImplementationOnce(async () => submitResponse('evt_empty'))
      .mockImplementationOnce(async () => sseResponse(''))

    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'ko' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
  })

  it('returns 503 when upstream fetch aborts (timeout) on the submit step', async () => {
    // AbortError at step 1 still goes through translateFallback (503).
    const err = new Error('Aborted')
    err.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(err)
    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'pt' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns 503 when upstream fetch fails without AbortError on the submit step', async () => {
    // Network failure (DNS/TCP/TLS) — same user-facing fallback as other errors.
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'))
    const res = await POST(jsonRequest({ text: 'Hello', targetLang: 'ru' }))
    expect(res.status).toBe(503)
    const j = (await res.json()) as { error?: string }
    expect(j.error).toBe(TRANSLATE_UNAVAILABLE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
