import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import {
  buildSafetyRecommendationPresentation,
  normalizeConfidence,
  normalizeLegitimacy,
  normalizeRiskLevel,
  selectNextSteps,
} from "@/lib/safetyRecommendations"
import { normalizeSeverity } from "@/lib/safetyNextSteps"
import type { SafetyFlags } from "@/types"

/** Values below this are treated as legacy model character offsets, not Unix ms. */
const LEGACY_OFFSET_MAX = 1_000_000_000_000

function pickEvidenceCharOffset(parsed: Record<string, unknown>): number | undefined {
  const fromField = parsed.evidenceCharOffset
  if (typeof fromField === "number" && Number.isFinite(fromField)) {
    return Math.max(0, Math.floor(fromField))
  }
  const legacy = parsed.detectedAt
  if (typeof legacy === "number" && Number.isFinite(legacy) && legacy < LEGACY_OFFSET_MAX) {
    return Math.max(0, Math.floor(legacy))
  }
  return undefined
}

function buildSafetyFlags(parsed: Record<string, unknown>): SafetyFlags {
  const category =
    typeof parsed.category === "string" && parsed.category.trim()
      ? parsed.category.trim()
      : "Unknown"
  const severity = normalizeSeverity(parsed.severity)
  const riskLevel = normalizeRiskLevel(parsed.riskLevel) ?? severity
  const confidence = normalizeConfidence(parsed.confidence)
  const legitimacy = normalizeLegitimacy(parsed.legitimacy)
  const explanation =
    typeof parsed.explanation === "string" ? parsed.explanation : undefined
  const hasExplanation = Boolean(explanation?.trim())
  const evidenceCharOffset = pickEvidenceCharOffset(parsed)
  const nextSteps = selectNextSteps({
    category,
    severity,
    confidence,
    legitimacy,
    hasExplanation,
  })

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

function getTextToAnalyze(body: unknown): string | null {
  const fullText = (body as { fullText?: string })?.fullText
  if (typeof fullText === "string" && fullText.trim().length > 0) {
    return fullText.trim()
  }
  const blocks = (body as {
    blocks?: Array<{ text: string; confidence?: number }>
  })?.blocks
  if (Array.isArray(blocks) && blocks.length > 0) {
    const text = blocks
      .map((b) => (b?.text ?? "").trim())
      .filter(Boolean)
      .join("\n")
    return text.length > 0 ? text : null
  }
  return null
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION_ERROR" },
      { status: 400 },
    )
  }

  const textToAnalyze = getTextToAnalyze(body)
  if (!textToAnalyze) {
    return NextResponse.json(
      {
        error: "fullText or blocks (with text) required",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    )
  }

  const openRouterApiToken = process.env.OPEN_ROUTER_API_TOKEN
  if (!openRouterApiToken) {
    return NextResponse.json(
      { error: "Safety check not configured", code: "CONFIG_ERROR" },
      { status: 500 },
    )
  }

  let prompt: string
  try {
    prompt = await fs.readFile(
      process.cwd() + "/app/api/safety/system-prompt.md",
      "utf-8",
    )
  } catch {
    return NextResponse.json(
      { error: "Safety check failed", code: "INTERNAL_ERROR" },
      { status: 500 },
    )
  }

  let res: Response
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stepfun/step-3.5-flash:free",
        max_tokens: 400,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: textToAnalyze },
        ],
        reasoning: { effort: "high", exclude: true },
      }),
    })
  } catch {
    return NextResponse.json(
      { error: "Safety check failed", code: "EXTERNAL_ERROR" },
      { status: 500 },
    )
  }

  let data: { choices?: Array<{ message?: { content?: string } }> }
  try {
    data = (await res.json()) as typeof data
  } catch {
    return NextResponse.json(
      { error: "Safety check failed", code: "INTERNAL_ERROR" },
      { status: 500 },
    )
  }

  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "Safety check failed", code: "INTERNAL_ERROR" },
      { status: 500 },
    )
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(content) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: "Safety check failed", code: "PARSE_ERROR" },
      { status: 500 },
    )
  }

  const flags = buildSafetyFlags(parsed)
  const presentation = buildSafetyRecommendationPresentation(flags)

  return NextResponse.json({ flags, presentation })
}
