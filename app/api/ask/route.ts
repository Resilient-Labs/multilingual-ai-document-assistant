import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextResponse } from "next/server";

/**
 * POST /api/ask
 * Stateless RAG endpoint. Client sends chat messages + optional context chunks.
 * Streams back the LLM response using the AI SDK data stream protocol.
 *
 * New shape:  { messages: Message[], chunks?: string[] }
 * Legacy shape (backward compat): { question: string, chunks?: string[], context?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Normalize: support both the new AI SDK message format and the legacy format
    let messages: { role: "user" | "assistant" | "system"; content: string }[] =
      [];
    let chunks: string[] = [];

    if (Array.isArray(body?.messages)) {
      // New shape
      messages = body.messages;
      chunks = Array.isArray(body?.chunks) ? body.chunks : [];
    } else if (body?.question) {
      // Legacy shape – convert to messages array
      const question = body.question as string;
      const contextText =
        (body?.context as string | undefined) ??
        (Array.isArray(body?.chunks) ? (body.chunks as string[]).join("\n\n") : "");
      chunks = Array.isArray(body?.chunks) ? body.chunks : [];
      if (!chunks.length && contextText) {
        chunks = [contextText];
      }
      messages = [{ role: "user", content: question }];
    } else {
      return NextResponse.json(
        { error: "Request must include 'messages' array or 'question' string" },
        { status: 400 }
      );
    }

    // Graceful fallback when the API key is not configured
    if (!process.env.OPENAI_API_KEY) {
      const fallbackMessage =
        "⚠️ OPENAI_API_KEY is not set. Please add it to your .env.local file to enable AI-powered answers.";
      return new Response(
        // Emit a single text delta followed by a finish event in the AI SDK data stream format
        `0:${JSON.stringify(fallbackMessage)}\n` +
          `d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`,
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "x-vercel-ai-data-stream": "v1",
          },
        }
      );
    }

    // Build the RAG system prompt
    const systemPrompt =
      chunks.length > 0
        ? [
            "You are a helpful assistant that answers questions about documents.",
            "Use only the context excerpts below to answer. If the answer is not in the context, say so.",
            "",
            "=== Context Excerpts ===",
            chunks.join("\n\n---\n\n"),
            "=== End of Context ===",
          ].join("\n")
        : "You are a helpful assistant that answers questions about documents.";

    const result = streamText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();
  } catch {
    return NextResponse.json(
      { error: "Question answering failed" },
      { status: 500 }
    );
  }
}
