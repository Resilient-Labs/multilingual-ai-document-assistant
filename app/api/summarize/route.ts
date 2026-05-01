import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { evaluateAsync } from '@/lib/evaluate'
import { detectPii, logWarn } from '@/lib/guardrails'

/**
 * POST /api/summarize
 * Team 2: Stateless. Client sends fullText. Backend returns summary.
 * Server stores nothing.
 *
 * Body: { fullText: string, outputLanguage?: string }
 *
 * When `outputLanguage` is a non-English BCP-47 code (e.g. `es`, `zh-TW`), the
 * model is instructed to write the full summary in that language.
 *
 * PII policy (matches `/api/translate` and `/api/tts`):
 * The summarize route is meant for users whose documents *will* contain
 * sensitive data — immigration paperwork, court filings, benefits letters,
 * medical bills. Refusing to summarize is the failure mode, not a
 * safeguard, because the user already has the document and is trying to
 * understand it. PII is *detected* via the shared `detectPii` registry for
 * observability (categories logged, never values), but never blocks the
 * request. If you need stricter behaviour for a future deployment, swap
 * the `logWarn` below for `checkInputPii` (still exported from
 * `@/lib/guardrails`).
 */

const SUMMARIZATION_PROMPT_PATH = path.join(
  process.cwd(),
  'app/api/summarize/summarizationPrompt.txt'
)

const ROUTE = '/api/summarize'

const MAX_TEXT_LENGTH = 100_000

// ---------------------------------------------------------------------------

type SummarizeRequestBody = {
  fullText?: unknown
  outputLanguage?: unknown
}

/** Extra system text so the summary matches the translate UI language (not English-only). */
function outputLanguageDirective(code: string): string {
  const trimmed = code.trim()
  if (!trimmed || trimmed === 'auto') return ''
  const tag = trimmed.replace(/_/g, '-')
  if (tag === 'en' || tag.startsWith('en-')) return ''
  let label: string
  try {
    label =
      new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag
  } catch {
    label = tag
  }
  return `\n\nLanguage requirement: Write your entire response (including section headings, bullet points, formatting labels, and vocabulary definitions) in ${label}. Do not use English except when quoting unavoidable proper nouns from the source text.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { fullText, outputLanguage } = body as SummarizeRequestBody
    if (typeof fullText !== 'string') {
      return NextResponse.json(
        { error: 'fullText must be a string' },
        { status: 400 }
      )
    }

    const trimmed = fullText.trim()
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: 'fullText is required and cannot be empty' },
        { status: 400 }
      )
    }

    // -- Guardrail: length cap --------------------------------------------------
    if (trimmed.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: `Text exceeds the maximum allowed length of ${MAX_TEXT_LENGTH.toLocaleString()} characters. Please shorten your document before summarizing.`,
        },
        { status: 422 }
      )
    }

    // -- Guardrail: sensitive information detection (DETECT-ONLY — never blocks) ---
    // See file-level docstring for rationale. We log categories only — no
    // raw text and no values — through the structured guardrail logger so
    // ops can monitor how often summaries process sensitive data without
    // any of it leaking into logs.
    const piiMatches = detectPii(trimmed)
    if (piiMatches.length > 0) {
      logWarn(
        ROUTE,
        'input-validation',
        'PII detected in input text — passing through (summarize route policy)',
        {
          textLength: trimmed.length,
          detectedTypes: piiMatches.map((m) => m.type),
        }
      )
    }
    // --------------------------------------------------------------------------

    const apiKey = process.env.HF_TOKEN
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: HF_TOKEN api key is not set' },
        { status: 500 }
      )
    }

    let systemInstruction: string
    try {
      systemInstruction = await fs.readFile(SUMMARIZATION_PROMPT_PATH, 'utf8')
    } catch {
      return NextResponse.json(
        { error: 'Failed to read summarization prompt' },
        { status: 500 }
      )
    }

    const langSuffix =
      typeof outputLanguage === 'string'
        ? outputLanguageDirective(outputLanguage)
        : ''
    const systemContent = systemInstruction + langSuffix

    const model =
      process.env.HF_SUMMARIZE_MODEL?.trim() ||
      'meta-llama/Llama-3.1-8B-Instruct:cheapest'

    let response
    try {
      response = await fetch(
        'https://router.huggingface.co/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: systemContent,
              },
              {
                role: 'user',
                content: trimmed,
              },
            ],
          }),
        }
      )
    } catch {
      return NextResponse.json(
        { error: 'Summarization failed: API error' },
        { status: 500 }
      )
    }

    const raw = await response.text()
    let data: {
      choices?: { message?: { content?: string } }[]
      error?: unknown
      message?: unknown
    }
    try {
      data = JSON.parse(raw) as typeof data
    } catch {
      return NextResponse.json(
        {
          error: 'Summarization failed: invalid response from provider',
          details: raw.slice(0, 500),
        },
        { status: 502 }
      )
    }

    if (!response.ok) {
      const detail =
        typeof data.error === 'string'
          ? data.error
          : typeof data.message === 'string'
            ? data.message
            : raw.slice(0, 500)
      return NextResponse.json(
        {
          error: 'Summarization provider request failed',
          details: detail,
          providerStatus: response.status,
        },
        { status: 502 }
      )
    }

    const summary = data.choices?.[0]?.message?.content
    if (!summary) {
      return NextResponse.json(
        {
          error: 'No summary generated',
          details: data.error ?? data.message ?? null,
        },
        { status: 500 }
      )
    }

    // Evaluation hook (`lib/evaluate.ts`): optional LangSmith run `evaluation-summarize`.
    // Fire-and-forget; active only when EVALUATIONS_ENABLED=true and LangSmith is configured.
    evaluateAsync({
      input: trimmed,
      output: summary,
      model,
      feature: 'summarize',
    })
    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 })
  }
}
