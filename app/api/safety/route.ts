import { NextResponse } from "next/server"
import { promises as fs } from "fs"

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
        model: "openai/gpt-5.2",
        max_tokens: 200,
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

  let flags: Record<string, unknown>
  try {
    flags = JSON.parse(content) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: "Safety check failed", code: "PARSE_ERROR" },
      { status: 500 },
    )
  }

  flags.detectedAt = Date.now()

  return NextResponse.json({ flags })
}
