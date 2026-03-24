import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { ModelMessage, UserModelMessage } from "ai";
import { NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const MAX_CHUNKS = 50;
const MAX_CHUNK_LENGTH = 10_000;
const MAX_MESSAGES = 100;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  if (!request.headers.get("x-requested-with")) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    let modelMessages: ModelMessage[] = [];
    let chunks: string[] = [];

    if (Array.isArray(body?.messages) && body.messages.length > 0) {
      if (body.messages.length > MAX_MESSAGES) {
        return NextResponse.json(
          {
            error: `Messages array exceeds limit of ${MAX_MESSAGES}`,
            code: "PAYLOAD_TOO_LARGE",
          },
          { status: 413 }
        );
      }
      chunks = Array.isArray(body?.chunks) ? body.chunks : [];
      modelMessages = await convertToModelMessages(body.messages);
    } else if (body?.question) {
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
        {
          error:
            "Request must include 'messages' array or 'question' string",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json(
        {
          error: `Chunks array exceeds limit of ${MAX_CHUNKS}`,
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 }
      );
    }
    if (chunks.some((c) => typeof c === "string" && c.length > MAX_CHUNK_LENGTH)) {
      return NextResponse.json(
        {
          error: `Individual chunk exceeds limit of ${MAX_CHUNK_LENGTH} characters`,
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      const fallbackText =
        "The AI service is not configured. Please contact the administrator to enable AI-powered answers.";
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ask] Request failed:", detail);
    return NextResponse.json(
      { error: "Request processing failed", code: "INTERNAL_ERROR", detail },
      { status: 500 }
    );
  }
}
