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
              explanation: flags.explanation ?? 'Test explanation',
              detectedAt: 0,
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
})
