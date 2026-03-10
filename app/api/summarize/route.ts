import { NextResponse } from "next/server";

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
    const body = await request.json();
    const fullText = body?.fullText as string | undefined;

    if (!fullText) {
      return NextResponse.json(
        { error: "fullText required" },
        { status: 400 }
      );
    }

    // TODO: Call LLM for summarization.
    const summary =
      fullText.trim().length > 0
        ? `[Summary placeholder. LLM integration pending.]`
        : "No content to summarize.";

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json(
      { error: "Summarization failed" },
      { status: 500 }
    );
  }
}
