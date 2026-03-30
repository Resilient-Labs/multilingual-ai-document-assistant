import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

/**
 * POST /api/ask
 * Team 3: Stateless RAG. Client sends question + context (chunks or fullText).
 * Backend streams an LLM answer using Vercel AI SDK with GPT-4o-mini.
 *
 * Body: { question: string, context?: string, chunks?: string[] }
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
        { status: 400 },
      );
    }

    const contextText = context ?? chunks?.join("\n\n") ?? "";

    const systemPrompt = contextText
      ? `You are a helpful document assistant. Answer the user's question using ONLY the provided document context. If the context doesn't contain enough information to answer, say so clearly. Do not make up information.\n\nDocument context:\n\n${contextText}`
      : `You are a helpful document assistant. Answer the user's question using ONLY the provided document context. If the context doesn't contain enough information to answer, say so clearly. Do not make up information.\n\nNo document context was provided.`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    return result.toUIMessageStreamResponse();
  } catch {
    return NextResponse.json(
      { error: "Question answering failed" },
      { status: 500 },
    );
  }
}
