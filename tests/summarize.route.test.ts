import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/summarize/route'

const samplesDir = join(process.cwd(), 'tests/samples')

/** OCR-style medical EOB–like notice used as realistic `fullText` in happy-path tests. */
const SAMPLE_DOCUMENT_TEXT = readFileSync(
  join(samplesDir, 'summarize-sample-document.txt'),
  'utf8'
)

/** Mock Hugging Face chat completion body — structured like the real summarization prompt output. */
const MOCK_MODEL_SUMMARY_TEXT = readFileSync(
  join(samplesDir, 'summarize-mock-model-summary.txt'),
  'utf8'
)

/**
 * Stub `fs.promises.readFile` so the route never reads a real prompt file.
 * (The real module is still used for anything else under `fs`.)
 */
const { readFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
}))

vi.mock('fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('fs')>()
  return {
    ...fs,
    promises: { ...fs.promises, readFile: readFileMock },
  }
})

/** POST body for /api/summarize — usually `fullText` comes from extract OCR (`ocr.fullText`). */
function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const hfJson = (summary: string = MOCK_MODEL_SUMMARY_TEXT) =>
  ({
    json: async () => ({
      choices: [{ message: { content: summary } }],
    }),
  }) as Awaited<ReturnType<typeof fetch>>

describe('POST /api/summarize', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.HF_TOKEN = 'test-token'
    readFileMock.mockResolvedValue('You are a summarizer.')
    fetchMock.mockResolvedValue(hfJson())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.HF_TOKEN
  })

  it('returns { summary } when the upstream model responds', async () => {
    const res = await POST(jsonRequest({ fullText: SAMPLE_DOCUMENT_TEXT }))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { summary: string }
    expect(data.summary).toBe(MOCK_MODEL_SUMMARY_TEXT)
  })

  it('trims fullText before sending it to the model', async () => {
    const firstLine =
      SAMPLE_DOCUMENT_TEXT.split('\n').find((l) => l.trim().length > 0) ?? ''
    await POST(jsonRequest({ fullText: `  ${firstLine.trim()}  ` }))
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: { role: string; content: string }[]
    }
    const user = body.messages.find((m) => m.role === 'user')
    expect(user?.content).toBe(firstLine.trim())
  })

  it('loads system instructions from summarizationPrompt.txt via readFile', async () => {
    readFileMock.mockResolvedValue('SYSTEM_PROMPT_FROM_FILE')
    await POST(jsonRequest({ fullText: SAMPLE_DOCUMENT_TEXT }))
    expect(readFileMock).toHaveBeenCalledWith(
      expect.stringMatching(/summarizationPrompt\.txt$/),
      'utf8'
    )
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: { role: string; content: string }[]
    }
    const system = body.messages.find((m) => m.role === 'system')
    expect(system?.content).toBe('SYSTEM_PROMPT_FROM_FILE')
  })

  it('rejects bad requests (invalid JSON, missing string, empty)', async () => {
    expect((await POST(jsonRequest('not-json'))).status).toBe(400)
    expect((await POST(jsonRequest({ fullText: '' }))).status).toBe(400)
    expect((await POST(jsonRequest({ fullText: '  \t  ' }))).status).toBe(400)
    expect((await POST(jsonRequest({ fullText: 1 }))).status).toBe(400)
  })

  it('returns 422 when text exceeds the maximum length', async () => {
    const res = await POST(jsonRequest({ fullText: 'a'.repeat(100_001) }))
    expect(res.status).toBe(422)
    const data = (await res.json()) as { error: string }
    expect(data.error).toMatch(/maximum allowed length/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 422 when sensitive personal information is detected', async () => {
    const res = await POST(
      jsonRequest({
        fullText:
          'For questions about this posting, email careers@example.org or call the main line.',
      })
    )
    expect(res.status).toBe(422)
    const data = (await res.json()) as {
      error: string
      detectedTypes: { type: string; label: string }[]
    }
    expect(data.error).toMatch(/sensitive personal information/i)
    expect(data.detectedTypes.some((d) => d.type === 'email')).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 500 if HF_TOKEN is not set', async () => {
    delete process.env.HF_TOKEN
    const res = await POST(
      jsonRequest({ fullText: SAMPLE_DOCUMENT_TEXT.slice(0, 80) })
    )
    expect(res.status).toBe(500)
  })

  it('returns 500 when the prompt file, network, or model response is bad', async () => {
    const shortDoc = SAMPLE_DOCUMENT_TEXT.split('\n')[0]

    readFileMock.mockRejectedValueOnce(new Error('ENOENT'))
    expect((await POST(jsonRequest({ fullText: shortDoc }))).status).toBe(500)

    fetchMock.mockRejectedValueOnce(new Error('network'))
    expect((await POST(jsonRequest({ fullText: shortDoc }))).status).toBe(500)

    fetchMock.mockResolvedValueOnce({
      json: async () => ({ choices: [] }),
    } as Awaited<ReturnType<typeof fetch>>)
    expect((await POST(jsonRequest({ fullText: shortDoc }))).status).toBe(500)
  })
})
