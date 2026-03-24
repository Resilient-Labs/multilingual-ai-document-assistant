import { NextResponse } from 'next/server'

/**
 * POST /api/summarize
 * Team 2: Stateless. Client sends fullText. Backend returns summary.
 * Server stores nothing.
 *
 * Body: { fullText: string }
 *
 * TODO: Integrate LLM for summarization.
 */
export async function POST(request: Request) {
  try {
    const body: { fullText?: string } = await request.json()
    const fullText = body.fullText

    if (!fullText) {
      return NextResponse.json({ error: 'fullText required' }, { status: 400 })
    }

    // === Mock summarization logic ===
    // Split text into sentences (simple placeholder logic)
    const sentences: string[] = fullText
      .split(/(?<=[.!?])\s+/)
      .filter((s: string) => s.length > 0)

    // Produce structured placeholders
    const documentPurpose =
      sentences.slice(0, 2).join(' ') || '[Document Purpose placeholder]'
    const detailedSummary =
      sentences.slice(2, 5).join(' ') || '[Detailed Summary placeholder]'
    const llmIntegration =
      '[LLM call placeholder — replace with actual LLM integration]'

    return NextResponse.json({
      documentPurpose,
      detailedSummary,
      llmIntegration,
    })
  } catch (err) {
    console.error('Summarization error:', err)
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 })
  }
}
