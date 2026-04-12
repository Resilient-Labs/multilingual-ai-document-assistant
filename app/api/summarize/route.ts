import fetch from 'node-fetch'
import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

/**
 * POST /api/summarize
 * Team 2: Stateless. Client sends fullText. Backend returns summary.
 * Server stores nothing.
 *
 * Body: { fullText: string }
 */

const SUMMARIZATION_PROMPT_PATH = path.join(
  process.cwd(),
  'app/api/summarize/summarizationPrompt.txt'
)

type SummarizeRequestBody = {
  fullText?: unknown
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

    const { fullText } = body as SummarizeRequestBody
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
            model: 'meta-llama/Llama-3.1-8B-Instruct:cheapest',
            messages: [
              {
                role: 'system',
                content: systemInstruction,
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

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const summary = data.choices?.[0]?.message?.content
    if (!summary) {
      return NextResponse.json(
        { error: 'No summary generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 })
  }
}
