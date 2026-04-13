import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

/**
 * POST /api/summarize
 * Team 2: Stateless. Client sends fullText. Backend returns summary.
 * Server stores nothing.
 *
 * Body: { fullText: string, outputLanguage?: string }
 *
 * When `outputLanguage` is a non-English BCP-47 code (e.g. `es`, `zh-TW`), the
 * model is instructed to write the full summary in that language.
 */

const SUMMARIZATION_PROMPT_PATH = path.join(
  process.cwd(),
  'app/api/summarize/summarizationPrompt.txt'
)

// guardrails

const MAX_TEXT_LENGTH = 100_000

type SensitiveMatch = {
  type: string
  label: string
}

const SENSITIVE_PATTERNS: Array<{
  type: string
  label: string
  pattern: RegExp
}> = [
  {
    type: 'ssn',
    label: 'Social Security Number (SSN)',
    // Matches XXX-XX-XXXX, XXX XX XXXX, or 9 consecutive digits
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
  },
  {
    type: 'credit_card',
    label: 'Credit or Debit Card Number',
    // Matches 16-digit card numbers with optional spaces/dashes between groups
    pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/,
  },
  {
    type: 'phone',
    label: 'Phone Number',
    // Matches US/international phone formats: (555) 555-5555, +1 555.555.5555, etc.
    pattern: /\b(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/,
  },
  {
    type: 'email',
    label: 'Email Address',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,
  },
  {
    type: 'credential',
    label: 'Password or API Key',
    // Matches patterns like "password: abc123", "api_key=xyz", "token: ..."
    pattern:
      /(?:password|passwd|pwd|api[_\s]?key|secret|bearer|token)\s*[:=]\s*\S{4,}/i,
  },
  {
    type: 'bank_account',
    label: 'Bank Account or Routing Number',
    // Matches explicit account/routing number labels followed by digits
    pattern:
      /\b(?:account|routing|acct)[\s_\-]?(?:number|num|no\.?|#)?\s*[:=]?\s*\d{8,17}\b/i,
  },
  {
    type: 'passport',
    label: 'Passport Number',
    // Matches common passport formats: letter(s) followed by 6-9 digits
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/,
  },
  {
    type: 'drivers_license',
    label: "Driver's License Number",
    // Matches a label followed by an alphanumeric ID
    pattern:
      /\b(?:driver['s]*\s*licen[sc]e|dl|d\.l\.)\s*(?:number|num|no\.?|#)?\s*[:=]?\s*[A-Z0-9]{5,15}\b/i,
  },
]

/**
 Scans text for sensitive PII patterns. Returns every category detected.
 Uses per-category deduplification so each type appears at most once.
 
 */
function detectSensitiveInfo(text: string): SensitiveMatch[] {
  const found: SensitiveMatch[] = []
  for (const { type, label, pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      found.push({ type, label })
    }
  }
  return found
}

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

    // -- Guardrail: sensitive information detection ----------------------------
    const sensitiveMatches = detectSensitiveInfo(trimmed)
    if (sensitiveMatches.length > 0) {
      return NextResponse.json(
        {
          error:
            'Submission blocked: your document appears to contain sensitive personal information. Please remove it before summarizing.',
          detectedTypes: sensitiveMatches,
        },
        { status: 422 }
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

    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 })
  }
}
