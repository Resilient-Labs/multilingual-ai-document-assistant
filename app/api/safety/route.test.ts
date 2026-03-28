import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import type { SafetyAnalysisResponse } from '@/types'

function createMockRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

function createSuccessfulFetchMock(flags: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              category: flags.category ?? 'Unknown',
              severity: flags.severity ?? 'low',
              riskLevel: flags.riskLevel,
              confidence: flags.confidence ?? 75,
              legitimacy: flags.legitimacy ?? 'uncertain',
              explanation: flags.explanation ?? 'Test explanation',
              evidenceCharOffset:
                (flags.evidenceCharOffset as number | undefined) ?? 42,
            }),
          },
        },
      ],
    }),
  })
}

describe('POST /api/safety', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.OPEN_ROUTER_API_TOKEN

  beforeEach(() => {
    process.env.OPEN_ROUTER_API_TOKEN = 'test-token'
    globalThis.fetch = vi.fn() as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
    process.env.OPEN_ROUTER_API_TOKEN = originalEnv
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

    it('returns 413 when text exceeds character limit', async () => {
      const request = createMockRequest({
        fullText: 'a'.repeat(50_001),
      })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(413)
      expect(body.code).toBe('INPUT_TOO_LONG')
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
      const fetchBody = JSON.parse(fetchCall[1]?.body as string)
      expect(fetchBody.messages[1].content).toContain('FINAL NOTICE')
      expect(fetchBody.messages[1].content).toContain(
        'Payment due within 7 days.'
      )
    })
  })

  describe('error handling', () => {
    it('returns 500 when OPEN_ROUTER_API_TOKEN is unset', async () => {
      process.env.OPEN_ROUTER_API_TOKEN = ''

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toContain('not configured')
      expect(body.code).toBe('CONFIG_ERROR')
    })

    it('returns 500 when OpenRouter returns invalid JSON in content', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json {{' } }],
        }),
      })

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.code).toBe('PARSE_ERROR')
    })

    it('returns 500 when OpenRouter response has no choices', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      })

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.code).toBe('INTERNAL_ERROR')
    })

    it('returns 502 UPSTREAM_ERROR when OpenRouter HTTP status is not ok', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () =>
          JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
      })

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(502)
      expect(body.code).toBe('UPSTREAM_ERROR')
      expect(body.detail).toContain('Rate limit')
    })

    it('returns 500 when fetch throws', async () => {
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      const request = createMockRequest({ fullText: 'Some text' })
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.code).toBe('EXTERNAL_ERROR')
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
        json: async () => ({
          choices: [{ message: { content: fenced } }],
        }),
      })

      const request = createMockRequest({ fullText: 'Buy now limited offer' })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(body.flags.category).toBe('Promotional')
    })

    it('accepts message content as array of text parts', async () => {
      const inner = JSON.stringify({
        category: 'Unknown',
        severity: 'low',
        confidence: 50,
        legitimacy: 'uncertain',
        explanation: 'Too short.',
        evidenceCharOffset: 0,
      })
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: [{ type: 'text', text: inner }],
              },
            },
          ],
        }),
      })

      const request = createMockRequest({ fullText: 'Hi' })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(body.flags.category).toBe('Unknown')
    })

    it('uses reasoning field when content is empty', async () => {
      const inner = JSON.stringify({
        category: 'Utility Bill',
        severity: 'low',
        confidence: 70,
        legitimacy: 'likely_legitimate',
        explanation: 'Routine bill.',
        evidenceCharOffset: 0,
      })
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: null,
                reasoning: inner,
              },
            },
          ],
        }),
      })

      const request = createMockRequest({ fullText: 'Electric bill due' })
      const response = await POST(request)
      const body = (await response.json()) as SafetyAnalysisResponse

      expect(response.status).toBe(200)
      expect(body.flags.category).toBe('Utility Bill')
    })
  })
})
