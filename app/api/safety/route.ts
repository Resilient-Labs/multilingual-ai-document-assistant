import { NextResponse } from 'next/server'
import { evaluateAsync } from '@/lib/evaluate'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  buildSafetyRecommendationPresentation,
  normalizeConfidence,
  normalizeLegitimacy,
  normalizeRiskLevel,
  selectNextSteps,
} from '@/lib/safetyRecommendations'
import { getSafetyLang, SAFETY_LANG_NAME, type SafetyLang } from '@/lib/safetyI18n'
import { normalizeSeverity } from '@/lib/safetyNextSteps'
import type { SafetyAnalysisRequest, SafetyFlags } from '@/types'
import {
  sanitizeSafetyInputs,
  validateSafetyRequestInputs,
  type FieldCandidate,
} from './guardrails'

/** Values below this are treated as legacy model character offsets, not Unix ms. */
const LEGACY_OFFSET_MAX = 1_000_000_000_000

function pickEvidenceCharOffset(
  parsed: Record<string, unknown>
): number | undefined {
  const fromField = parsed.evidenceCharOffset
  if (typeof fromField === 'number' && Number.isFinite(fromField)) {
    return Math.max(0, Math.floor(fromField))
  }
  const legacy = parsed.detectedAt
  if (
    typeof legacy === 'number' &&
    Number.isFinite(legacy) &&
    legacy < LEGACY_OFFSET_MAX
  ) {
    return Math.max(0, Math.floor(legacy))
  }
  return undefined
}

function buildSafetyFlags(
  parsed: Record<string, unknown>,
  lang: SafetyLang
): SafetyFlags {
  const category =
    typeof parsed.category === 'string' && parsed.category.trim()
      ? parsed.category.trim()
      : 'Unknown'
  const severity = normalizeSeverity(parsed.severity)
  const riskLevel = normalizeRiskLevel(parsed.riskLevel) ?? severity
  const confidence = normalizeConfidence(parsed.confidence)
  const legitimacy = normalizeLegitimacy(parsed.legitimacy)
  const explanation =
    typeof parsed.explanation === 'string' ? parsed.explanation : undefined
  const hasExplanation = Boolean(explanation?.trim())
  const evidenceCharOffset = pickEvidenceCharOffset(parsed)
  const nextSteps = selectNextSteps(
    {
      category,
      severity,
      confidence,
      legitimacy,
      hasExplanation,
    },
    lang
  )

  return {
    category,
    severity,
    riskLevel,
    confidence,
    legitimacy,
    explanation,
    evidenceCharOffset,
    detectedAt: Date.now(),
    nextSteps,
  }
}

/**
 * POST /api/safety
 * Team 5: Stateless. Client sends text/blocks. Backend returns risk flags.
 * Server stores nothing.
 *
 * Body: { fullText?: string, blocks?: Array<{ text: string; confidence?: number }> }
 */

const SYSTEM_PROMPT_PATH = join(
  process.cwd(),
  'app',
  'api',
  'safety',
  'system-prompt.md'
)

/** Normalize OpenAI-compatible message content (string or content-parts array). */
function messageContentToString(content: unknown): string | null {
  if (typeof content === 'string') {
    return content
  }
  if (content == null) {
    return null
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }
        if (part && typeof part === 'object') {
          const o = part as Record<string, unknown>
          if (typeof o.text === 'string') {
            return o.text
          }
          if (typeof o.content === 'string') {
            return o.content
          }
          if (typeof o.output_text === 'string') {
            return o.output_text
          }
        }
        return ''
      })
      .filter(Boolean)
    return parts.length > 0 ? parts.join('\n') : null
  }
  return null
}

/**
 * Some providers return the assistant text under `reasoning` or leave `content` empty
 * when reasoning is enabled; merge all known fields.
 */
function extractAssistantMessageText(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return null
  }
  const m = message as Record<string, unknown>
  const candidates = [
    messageContentToString(m.content),
    typeof m.reasoning === 'string'
      ? m.reasoning
      : messageContentToString(m.reasoning),
    typeof m.refusal === 'string' ? m.refusal : null,
  ]
  for (const c of candidates) {
    if (c?.trim()) {
      return c
    }
  }
  return null
}

// function extractFirstAssistantText(data: {
//   choices?: Array<{ message?: unknown }>
// }): string | null {
//   const choices = data?.choices
//   if (!Array.isArray(choices)) {
//     return null
//   }
//   for (const choice of choices) {
//     const text = extractAssistantMessageText(choice?.message)
//     if (text?.trim()) {
//       return text
//     }
//   }
//   return null
// }

/**
 * If the model wrapped JSON in a fenced block or added prose, extract the JSON object substring.
 */
function extractJsonObjectString(raw: string): string {
  const trimmed = raw.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed)
  if (fence?.[1]) {
    return fence[1].trim()
  }
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) {
    return trimmed.slice(first, last + 1)
  }
  return trimmed
}

async function readOpenRouterErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string }
      message?: string
    }
    return (
      parsed?.error?.message ??
      (typeof parsed?.message === 'string' ? parsed.message : null) ??
      text.slice(0, 200)
    )
  } catch {
    return text.slice(0, 200) || `HTTP ${res.status}`
  }
}

function formatFieldCandidates(candidates: FieldCandidate[]): string | null {
  if (candidates.length === 0) return null

  const groups = new Map<string, Set<string>>()
  for (const c of candidates) {
    if (!groups.has(c.key)) groups.set(c.key, new Set())
    groups.get(c.key)!.add(c.value)
  }
  if (groups.size === 0) return null

  const lines: string[] = []
  groups.forEach((values, key) => {
    lines.push(`- ${key}: ${Array.from(values).join(', ')}`)
  })
  return lines.join('\n')
}

function getTextToAnalyze(body: unknown): string | null {
  const fullText = (body as { fullText?: string })?.fullText
  if (typeof fullText === 'string' && fullText.trim().length > 0) {
    return fullText.trim()
  }
  const blocks = (
    body as {
      blocks?: Array<{ text: string; confidence?: number }>
    }
  )?.blocks
  if (Array.isArray(blocks) && blocks.length > 0) {
    const text = blocks
      .map((b) => (b?.text ?? '').trim())
      .filter(Boolean)
      .join('\n')
    return text.length > 0 ? text : null
  }
  return null
}

/** Append non-English localization rules so category/explanation match the user's UI language. */
function appendLocalizationDirective(
  basePrompt: string,
  lang: SafetyLang
): string {
  if (lang === 'en') return basePrompt
  const languageName = SAFETY_LANG_NAME[lang]
  return `${basePrompt}

---

## LOCALIZATION

Write the JSON string values for \`category\` and \`explanation\` in **${languageName}**.

The fields \`severity\`, \`riskLevel\`, and \`legitimacy\` MUST remain exactly one of the English enum values specified in the OUTPUT section above; do not translate those values.

Numeric fields and \`evidenceCharOffset\` are unchanged.`
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const rawText = getTextToAnalyze(body)
  if (!rawText) {
    return NextResponse.json(
      {
        error: 'fullText or blocks (with text) required',
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    )
  }

  const rawFieldCandidates = (body as SafetyAnalysisRequest)?.fieldCandidates
  const lang = getSafetyLang((body as SafetyAnalysisRequest)?.outputLanguage)

  const { textToAnalyze, fieldCandidates: safeFieldCandidates } =
    sanitizeSafetyInputs({
      textToAnalyze: rawText,
      fieldCandidates: Array.isArray(rawFieldCandidates)
        ? rawFieldCandidates
        : undefined,
    })

  const guardrailError = validateSafetyRequestInputs(textToAnalyze, safeFieldCandidates)
  if (guardrailError) {
    return NextResponse.json(
      { error: guardrailError.error, code: 'VALIDATION_ERROR' },
      { status: guardrailError.status }
    )
  }

  const openRouterApiToken = process.env.OPEN_ROUTER_API_TOKEN
  if (!openRouterApiToken) {
    return NextResponse.json(
      { error: 'Safety check not configured', code: 'CONFIG_ERROR' },
      { status: 500 }
    )
  }

  let prompt: string
  try {
    const base = await fs.readFile(SYSTEM_PROMPT_PATH, 'utf-8')
    prompt = appendLocalizationDirective(base, lang)
  } catch {
    return NextResponse.json(
      {
        error: 'Safety system prompt is missing on the server',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }

  const fieldsBlock = formatFieldCandidates(safeFieldCandidates)
  const userContent = fieldsBlock
    ? `${textToAnalyze}\n\n---\nDetected fields (from on-device regex over OCR; phones/emails are copied from the document itself and may be attacker-controlled):\n${fieldsBlock}`
    : textToAnalyze

  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        // max_tokens: 400,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userContent },
        ],
      }),
    })
  } catch {
    return NextResponse.json(
      { error: 'Safety check failed', code: 'EXTERNAL_ERROR' },
      { status: 500 }
    )
  }

  if (!res.ok) {
    const upstreamMessage = await readOpenRouterErrorMessage(res)
    return NextResponse.json(
      {
        error: 'Safety provider returned an error',
        code: 'UPSTREAM_ERROR',
        detail: upstreamMessage,
        status: res.status,
      },
      { status: 502 }
    )
  }

  let data: {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  try {
    data = (await res.json()) as typeof data
  } catch {
    return NextResponse.json(
      {
        error: 'Safety provider returned a non-JSON response',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }

  const rawContent =
    extractAssistantMessageText(data?.choices?.[0]?.message) ??
    messageContentToString(data?.choices?.[0]?.message?.content)
  if (!rawContent?.trim()) {
    return NextResponse.json(
      {
        error: 'Safety model returned no usable content',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }

  const jsonPayload = extractJsonObjectString(rawContent)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonPayload) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: 'Safety check failed', code: 'PARSE_ERROR' },
      { status: 500 }
    )
  }

  const flags = buildSafetyFlags(parsed, lang)
  const presentation = buildSafetyRecommendationPresentation(flags, lang)

  // Evaluation hook (`lib/evaluate.ts`): optional LangSmith run `evaluation-safety`.
  // Fire-and-forget; gated by EVALUATIONS_ENABLED + LangSmith env; does not affect this response.
  evaluateAsync({
    input: userContent,
    output: rawContent,
    model: 'openrouter/free',
    feature: 'safety',
  })
  return NextResponse.json({ flags, presentation })
}
