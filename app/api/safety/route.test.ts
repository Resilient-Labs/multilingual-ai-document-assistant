import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import { SAFETY_DISCLAIMER, SAFETY_SEVERITY_LABELS } from '@/lib/safetyI18n'
import type { SafetyAnalysisResponse } from '@/types'

/**
 * The safety route POSTs to the dedicated HF Inference Endpoint with the
 * shape `{"inputs":{"messages":[system,user]}}` and reads
 * `{"generated_text":"<json string>"}` back. The route still runs the
 * model's reply through `extractJsonObjectString` to tolerate fenced
 * blocks / surrounding prose, then `JSON.parse`s the result into safety
 * flags. These tests mock global `fetch` to return that exact shape.
 */

const TEST_HF_URL =
  'https://test-endpoint.us-east-1.aws.endpoints.huggingface.cloud'

function createMockRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

/** Build a fetch mock that returns a successful HF Inference Endpoint
 *  response whose `generated_text` is a JSON string conforming to the
 *  safety route's expected shape. */
function createSuccessfulFetchMock(flags: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      generated_text: JSON.stringify({
        category: flags.category ?? 'Unknown',
        severity: flags.severity ?? 'low',
        riskLevel: flags.riskLevel,
        confidence: flags.confidence ?? 75,
        legitimacy: flags.legitimacy ?? 'uncertain',
        explanation: flags.explanation ?? 'Test explanation',
        evidenceCharOffset:
          (flags.evidenceCharOffset as number | undefined) ?? 42,
      }),
    }),
  })
}

describe('POST /api/safety', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.HF_INFERENCE_ENDPOINT_URL

  beforeEach(() => {
    process.env.HF_INFERENCE_ENDPOINT_URL = TEST_HF_URL
    globalThis.fetch = vi.fn() as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
    process.env.HF_INFERENCE_ENDPOINT_URL = originalEnv
  })

  describe('validation', () => {
    it('returns 400 for missing body (invalid JSON)', async () => {
      const request = createMockRequest(undefined)
      ;(request.json as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Invalid JSON')
      )

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid JSON')
      expect(body.code).toBe('VALIDATION_ERROR')
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('returns 400 when both fullText and blocks are missing', async () => {
      const request = createMockRequest({})
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('fullText or blocks')
      expect(body.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when fullText is empty string', async () => {
      const request = createMockRequest({ fullText: '   ' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('fullText or blocks')
      expect(body.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when blocks is empty array', async () => {
      const request = createMockRequest({ blocks: [] })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('fullText or blocks')
      expect(body.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when blocks have no text', async () => {
      const request = createMockRequest({
        blocks: [{ text: '' }, { text: '   ' }],
      })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('fullText or blocks')
      expect(body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('valid fullText', () => {
    it('returns 200 with flags for valid fullText', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        createSuccessfulFetchMock({
          category: 'Medical Bill',
          severity: 'medium',
          explanation: 'Document requests payment.',
        })
      )

      const request = createMockRequest({
        fullText: 'This is a medical bill for $500.',
      })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(body.flags).toBeDefined()
      expect(body.flags.category).toBe('Medical Bill')
      expect(body.flags.severity).toBe('medium')
      expect(body.flags.explanation).toBeDefined()
      expect(body.flags.detectedAt).toBeGreaterThan(0)
      expect(body.flags.evidenceCharOffset).toBe(42)
      expect(Array.isArray(body.flags.nextSteps)).toBe(true)
      expect(body.flags.nextSteps.length).toBeGreaterThan(0)
      expect(body.flags.nextSteps[0]).toMatchObject({
        label: expect.any(String),
        type: expect.stringMatching(/^(phone|url|info)$/),
      })
      expect(body.presentation).toBeDefined()
      expect(body.presentation.headline).toContain('Medical Bill')
      expect(body.presentation.summary).toBeNull()
      expect(body.presentation.primaryActions.length).toBe(
        body.flags.nextSteps.length
      )
      expect(body.flags.confidence).toBe(75)
    })

    it('POSTs to the configured HF endpoint with the inputs+messages shape', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        createSuccessfulFetchMock({ category: 'Utility Bill', severity: 'low' })
      )

      const request = createMockRequest({
        fullText: 'Your electric bill is ready.',
      })
      await POST(request)

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit]
      expect(url).toBe(`${TEST_HF_URL}/`)
      expect(init.method).toBe('POST')

      const fetchBody = JSON.parse(init.body as string) as {
        inputs?: { messages?: Array<{ role: string; content: string }> }
      }
      const messages = fetchBody.inputs?.messages
      expect(Array.isArray(messages)).toBe(true)
      expect(messages![0].role).toBe('system')
      expect(messages![1].role).toBe('user')
      expect(messages![1].content).toContain('Your electric bill is ready.')
    })

    it('includes localization directive and Spanish presentation when outputLanguage is es', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        createSuccessfulFetchMock({
          category: 'Medical Bill',
          severity: 'medium',
          explanation: 'Document requests payment.',
        })
      )

      const request = createMockRequest({
        fullText: 'This is a medical bill for $500.',
        outputLanguage: 'es',
      })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]
      const fetchBody = JSON.parse(fetchCall[1]?.body as string) as {
        inputs: { messages: Array<{ content: string }> }
      }
      const systemContent = fetchBody.inputs.messages[0].content
      expect(systemContent).toContain('## LOCALIZATION')
      expect(systemContent).toContain('Spanish')

      expect(body.presentation.severityLabel).toBe(
        SAFETY_SEVERITY_LABELS.es.medium
      )
      expect(body.presentation.disclaimer).toBe(SAFETY_DISCLAIMER.es)
    })
  })

  describe('valid blocks', () => {
    it('returns 200 with flags when using blocks only (no fullText)', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        createSuccessfulFetchMock({
          category: 'Debt Collection Letter',
          severity: 'high',
        })
      )

      const request = createMockRequest({
        blocks: [
          { text: 'FINAL NOTICE', confidence: 0.95 },
          { text: 'Payment due within 7 days.', confidence: 0.9 },
        ],
      })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(body.flags).toBeDefined()
      expect(body.flags.category).toBe('Debt Collection Letter')
      expect(body.flags.severity).toBe('high')
      expect(body.flags.detectedAt).toBeGreaterThan(0)
      expect(body.flags.nextSteps.length).toBeGreaterThanOrEqual(3)

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]
      const fetchBody = JSON.parse(fetchCall[1]?.body as string) as {
        inputs: { messages: Array<{ content: string }> }
      }
      const userMsg = fetchBody.inputs.messages[1].content
      expect(userMsg).toContain('FINAL NOTICE')
      expect(userMsg).toContain('Payment due within 7 days.')
    })
  })

  describe('error handling', () => {
    it('returns 500 when HF_INFERENCE_ENDPOINT_URL is unset', async () => {
      process.env.HF_INFERENCE_ENDPOINT_URL = ''

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toContain('not configured')
      expect(body.code).toBe('CONFIG_ERROR')
    })

    it('returns 500 PARSE_ERROR when generated_text is not valid JSON', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ generated_text: 'not valid json {{' }),
      })

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.code).toBe('PARSE_ERROR')
    })

    it('returns 502 UPSTREAM_ERROR when generated_text field is missing', async () => {
      // Empty body still parses as JSON, but the helper rejects on
      // missing/non-string `generated_text`. The route maps that to a
      // 502 UPSTREAM_ERROR, same as any other provider failure.
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(502)
      expect(body.code).toBe('UPSTREAM_ERROR')
    })

    it('returns 502 UPSTREAM_ERROR when the HF endpoint HTTP status is not ok', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      })

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(502)
      expect(body.code).toBe('UPSTREAM_ERROR')
      expect(body.detail).toContain('Rate limit')
    })

    it('returns 502 UPSTREAM_ERROR when fetch throws', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(502)
      expect(body.code).toBe('UPSTREAM_ERROR')
    })
  })

  describe('fieldCandidates', () => {
    it('includes a Detected fields block in the user message', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        createSuccessfulFetchMock({
          category: 'Scam Suspect',
          severity: 'high',
        })
      )

      const request = createMockRequest({
        fullText: 'Please call us to resolve your case.',
        fieldCandidates: [
          { key: 'phone', value: '555-123-4567', confidence: 0.9 },
          { key: 'phone', value: '555-123-4567', confidence: 0.8 },
          { key: 'email', value: 'agent@irs-refund.biz', confidence: 0.85 },
          { key: 'amount', value: '$1,250.00', confidence: 0.95 },
          { key: 'blank', value: '   ', confidence: 0.5 },
        ],
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]
      const fetchBody = JSON.parse(fetchCall[1]?.body as string) as {
        inputs: { messages: Array<{ content: string }> }
      }
      const userContent = fetchBody.inputs.messages[1].content

      expect(userContent).toContain('Please call us to resolve your case.')
      expect(userContent).toContain('Detected fields')
      expect(userContent).toContain('- phone: 555-123-4567')
      expect(userContent).toContain('- email: agent@irs-refund.biz')
      expect(userContent).toContain('- amount: $1,250.00')
      expect(userContent).not.toContain('- blank:')
      expect((userContent.match(/555-123-4567/g) ?? []).length).toBe(1)
    })

    it('omits the Detected fields block when fieldCandidates is empty or missing', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        createSuccessfulFetchMock({
          category: 'Utility Bill',
          severity: 'low',
        })
      )

      const request = createMockRequest({
        fullText: 'Your electric bill is ready.',
        fieldCandidates: [],
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]
      const fetchBody = JSON.parse(fetchCall[1]?.body as string) as {
        inputs: { messages: Array<{ content: string }> }
      }
      const userContent = fetchBody.inputs.messages[1].content

      expect(userContent).toBe('Your electric bill is ready.')
      expect(userContent).not.toContain('Detected fields')
    })
  })

  describe('model output shapes', () => {
    it('parses JSON wrapped in markdown fences', async () => {
      const payload = {
        category: 'Promotional',
        severity: 'low',
        confidence: 80,
        legitimacy: 'uncertain',
        explanation: 'Looks like marketing.',
        evidenceCharOffset: 0,
      }
      const fenced = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ generated_text: fenced }),
      })

      const request = createMockRequest({ fullText: 'Buy now limited offer' })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(body.flags.category).toBe('Promotional')
    })

    it('extracts the JSON object from prose-wrapped responses', async () => {
      const payload = {
        category: 'Unknown',
        severity: 'low',
        confidence: 50,
        legitimacy: 'uncertain',
        explanation: 'Too short.',
        evidenceCharOffset: 0,
      }
      // Some chat models prefix their JSON output with a sentence; the
      // route's `extractJsonObjectString` handles that by slicing from
      // the first `{` to the last `}`.
      const wrapped = `Here is the analysis: ${JSON.stringify(payload)} — that's my best read.`
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ generated_text: wrapped }),
      })

      const request = createMockRequest({ fullText: 'Hi' })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(body.flags.category).toBe('Unknown')
    })
  })
})
