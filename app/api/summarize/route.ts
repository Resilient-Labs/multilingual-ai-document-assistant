import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

/**
 * POST /api/summarize
 * Team 2: Stateless. Client sends fullText. Backend returns summary.
 * Server stores nothing.
 *
 * Body: { fullText: string }
 */

const SUMMARIZATION_PROMPT_PATH = path.join(
  process.cwd(),
  "app/api/summarize/summarizationPrompt.txt"
);

type SummarizeRequestBody = {
  fullText?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { fullText } = body as SummarizeRequestBody;
    if (typeof fullText !== "string") {
      return NextResponse.json(
        { error: "fullText must be a string" },
        { status: 400 }
      );
    }

    const trimmed = fullText.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "fullText is required and cannot be empty" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: GEMINI_API_KEY is not set" },
        { status: 500 }
      );
    }

    let systemInstruction: string;
    try {
      systemInstruction = await fs.readFile(SUMMARIZATION_PROMPT_PATH, "utf8");
    } catch (err) {
      console.error("Failed to read summarization prompt:", err);
      return NextResponse.json(
        { error: "Failed to read summarization prompt" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({});

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: trimmed,
        config: {
          systemInstruction,
        },
      });
    } catch (err) {
      console.error("Gemini API error:", err);
      return NextResponse.json(
        { error: "Summarization failed: Gemini API error" },
        { status: 500 }
      );
    }

    const summary = response.text;
    if (summary === undefined || summary === "") {
      return NextResponse.json(
        { error: "No summary generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Summarization failed:", err);
    return NextResponse.json(
      { error: "Summarization failed" },
      { status: 500 }
    );
  }
}
