import { NextResponse } from "next/server";

/**
 * POST /api/safety
 * Team 5: Stateless. Client sends text/blocks. Backend returns risk flags.
 * Server stores nothing.
 *
 * Body: { fullText?: string, blocks?: Array<{ text: string; confidence?: number }> }
 *
 * TODO: Implement risk classification (scams, eviction notices, urgent docs).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullText = body?.fullText as string | undefined;
    const blocks = body?.blocks as Array<{ text: string; confidence?: number }> | undefined;
    const textToAnalyze = fullText ?? blocks?.map((b) => b.text).join("\n") ?? "";

    // TODO: Run classification on textToAnalyze.
    const flags = {
      hasUrgentContent: false,
      hasEvictionNotice: false,
      hasScamIndicators: false,
      details: textToAnalyze ? [] : [],
    };

    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json(
      { error: "Safety check failed" },
      { status: 500 }
    );
  }
}
