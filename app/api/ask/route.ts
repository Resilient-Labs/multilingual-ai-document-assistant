import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { ModelMessage, UserModelMessage } from "ai";
import { NextResponse } from "next/server";

/**
 * POST /api/ask
 * Stateless RAG endpoint. Client sends chat messages + optional context chunks.
 * Streams back the LLM response using the AI SDK UIMessage stream protocol.
 *
 * New shape (v3 useChat):  { id, messages: UIMessage[], chunks?: string[], trigger, messageId }
 * Legacy shape (backward compat): { question: string, chunks?: string[], context?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    let modelMessages: ModelMessage[] = [];
    let chunks: string[] = [];

    if (Array.isArray(body?.messages) && body.messages.length > 0) {
      // New shape from @ai-sdk/react v3 useChat – messages are UIMessage[]
      chunks = Array.isArray(body?.chunks) ? body.chunks : [];
      modelMessages = await convertToModelMessages(body.messages);
    } else if (body?.question) {
      // Legacy shape – convert plain question string to ModelMessage
      const question = body.question as string;
      const contextText =
        (body?.context as string | undefined) ??
        (Array.isArray(body?.chunks)
          ? (body.chunks as string[]).join("\n\n")
          : "");
      chunks = Array.isArray(body?.chunks) ? body.chunks : [];
      if (!chunks.length && contextText) {
        chunks = [contextText];
      }
      const userMessage: UserModelMessage = {
        role: "user",
        content: question,
      };
      modelMessages = [userMessage];
    } else {
      return NextResponse.json(
        { error: "Request must include 'messages' array or 'question' string" },
        { status: 400 }
      );
    }

    // Graceful fallback when the API key is not configured
    if (!process.env.OPENAI_API_KEY) {
      const fallbackText =
        "⚠️ OPENAI_API_KEY is not set. Please add it to your .env.local file to enable AI-powered answers.";
      const events = [
        JSON.stringify({ type: "start", messageId: "fallback-msg" }),
        JSON.stringify({ type: "text-start", id: "fallback-part" }),
        JSON.stringify({
          type: "text-delta",
          id: "fallback-part",
          delta: fallbackText,
        }),
        JSON.stringify({ type: "text-end", id: "fallback-part" }),
        JSON.stringify({ type: "finish", finishReason: "stop" }),
        "[DONE]",
      ];
      const sseBody = events.map((e) => `data: ${e}\n\n`).join("");
      return new Response(sseBody, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
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
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch {
    return NextResponse.json(
      { error: "Question answering failed" },
      { status: 500 }
    );
  }
}
