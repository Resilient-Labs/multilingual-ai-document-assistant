import { NextResponse } from 'next/server'
import { evaluateAsync } from '@/lib/evaluate'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  buildSafetyRecommendationPresentation,
  maxSeverity,
  normalizeConfidence,
  normalizeLegitimacy,
  normalizeRiskLevel,
  selectNextSteps,
} from '@/lib/safetyRecommendations'
import { getSafetyLang, SAFETY_LANG_NAME, type SafetyLang } from '@/lib/safetyI18n'
import { normalizeSeverity } from '@/lib/safetyNextSteps'
import {
  callHfInferenceSafetyProvider,
  SafetyInferenceProviderError,
} from '@/lib/safetyHfInferenceProvider'
import type { SafetyAnalysisRequest, SafetyFlags } from '@/types'
import {
  sanitizeSafetyInputs,
  validateSafetyRequestInputs,
  type FieldCandidate,
} from './guardrails'

/**
 * Upstream provider: the team's dedicated HF Inference Endpoint
 * (`HF_INFERENCE_ENDPOINT_URL`). Custom handler that accepts
 * `{"inputs": {"messages": [...]}}` and returns
 * `{"generated_text": "..."}`. The model is instructed by
 * `system-prompt.md` to emit a JSON object; we still run that string
 * through `extractJsonObjectString` to tolerate fenced blocks /
 * surrounding prose. Implementation in `lib/safetyHfInferenceProvider`.
 *
 * Returns 500 `CONFIG_ERROR` when `HF_INFERENCE_ENDPOINT_URL` is unset.
 */

/** Long timeout to absorb HF Inference Endpoint cold starts; safety
 * reasoning is slower than translate/ask (~7–10s observed in probes). */
const HF_INFERENCE_SAFETY_TIMEOUT_MS = 180_000

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
  let riskLevel = normalizeRiskLevel(parsed.riskLevel) ?? severity
  const confidence = normalizeConfidence(parsed.confidence)
  const legitimacy = normalizeLegitimacy(parsed.legitimacy)
  if (legitimacy === 'likely_scam') {
    riskLevel = maxSeverity(maxSeverity(riskLevel, severity), 'high')
  }
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

  const inferenceEndpointUrl =
    process.env.HF_INFERENCE_ENDPOINT_URL?.trim() || undefined
  if (!inferenceEndpointUrl) {
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

  // ── Upstream call ────────────────────────────────────────────────────────
  let rawContent: string
  try {
    rawContent = await callHfInferenceSafetyProvider({
      url: inferenceEndpointUrl,
      systemPrompt: prompt,
      userContent,
      hfToken: process.env.HF_TOKEN?.trim() || undefined,
      timeoutMs: HF_INFERENCE_SAFETY_TIMEOUT_MS,
    })
  } catch (err) {
    const status =
      err instanceof SafetyInferenceProviderError ? err.status : undefined
    const detail =
      err instanceof SafetyInferenceProviderError && err.snippet
        ? err.snippet
        : err instanceof Error
          ? err.message
          : String(err)
    return NextResponse.json(
      {
        error: 'Safety provider returned an error',
        code: 'UPSTREAM_ERROR',
        detail,
        status,
      },
      { status: 502 }
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
    model: 'hf-inference-endpoint',
    feature: 'safety',
  })
  return NextResponse.json({ flags, presentation })
}
