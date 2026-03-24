import { streamText } from "ai";
import { createHuggingFace } from "@ai-sdk/huggingface";
import { NextResponse } from "next/server";

const MODEL_ID = "mistralai/Mistral-Small-24B-Instruct-2501";

export async function POST(request: Request) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HuggingFace API key not configured", code: "CONFIG_ERROR" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const question = (body as Record<string, unknown>)?.question as
    | string
    | undefined;
  const context = (body as Record<string, unknown>)?.context as
    | string
    | undefined;
  const chunks = (body as Record<string, unknown>)?.chunks as
    | string[]
    | undefined;

  if (!question) {
    return NextResponse.json(
      { error: "question required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const contextText = context ?? chunks?.join("\n\n") ?? "";
  if (!contextText) {
    return NextResponse.json(
      { error: "context or chunks required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const huggingface = createHuggingFace({ apiKey });

  try {
    const result = streamText({
      model: huggingface(MODEL_ID),
      system: `You are a helpful document assistant. Answer the user's question based ONLY on the following document excerpts. If the excerpts do not contain enough information, say so.\n\n--- Document Excerpts ---\n${contextText}\n--- End of Excerpts ---`,
      prompt: question,
    });

    return result.toTextStreamResponse();
  } catch {
    return NextResponse.json(
      { error: "LLM inference failed", code: "EXTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
