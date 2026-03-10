import { NextResponse } from "next/server";

/**
 * POST /api/ask
 * Team 3: Stateless RAG. Client sends question + context (chunks or fullText).
 * Backend returns LLM answer. Server stores nothing.
 *
 * Body: { question: string, context: string } or { question: string, chunks: string[] }
 *
 * TODO: Integrate LLM (e.g. OpenAI, Anthropic).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = body?.question as string | undefined;
    const context = body?.context as string | undefined;
    const chunks = body?.chunks as string[] | undefined;

    if (!question) {
      return NextResponse.json(
        { error: "question required" },
        { status: 400 }
      );
    }

    const contextText = context ?? chunks?.join("\n\n") ?? "";

    // TODO: Build RAG prompt, call LLM.
    const answer = contextText
      ? `Based on the document: ${contextText.slice(0, 500)}... [LLM integration pending]`
      : "No relevant information found. Please provide context (fullText or chunks) in the request body.";

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { error: "Question answering failed" },
      { status: 500 }
    );
  }
}
