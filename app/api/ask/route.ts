import { NextResponse } from "next/server";
import { getWithParse } from "@/lib/redis";
import { REDIS_KEYS } from "@/lib/constants";
import type { TextChunk, ChunkEmbedding } from "@/types";

/**
 * POST /api/ask
 * Team 3: RAG question answering.
 * 1. Receive question
 * 2. Generate query embedding
 * 3. Retrieve chunks from Redis
 * 4. Build context
 * 5. Send prompt to LLM
 * 6. Return answer
 *
 * Body: { docId: string, question: string }
 *
 * TODO: Integrate embedding model and LLM (e.g. OpenAI, Anthropic).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const docId = body?.docId as string | undefined;
    const question = body?.question as string | undefined;

    if (!docId || !question) {
      return NextResponse.json(
        { error: "docId and question required" },
        { status: 400 }
      );
    }

    const chunks = await getWithParse<TextChunk[]>(REDIS_KEYS.chunks(docId));
    const embeddings = await getWithParse<ChunkEmbedding[]>(
      REDIS_KEYS.embeddings(docId)
    );
    const doc = await getWithParse(REDIS_KEYS.doc(docId));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or expired" },
        { status: 404 }
      );
    }

    // TODO: Generate query embedding, vector similarity search, build RAG prompt.
    // For now, use fullText as fallback context.
    const fullText =
      (doc as { ocr?: { fullText?: string } })?.ocr?.fullText ?? "";
    const context = chunks?.length
      ? chunks.map((c) => c.text).join("\n\n")
      : fullText;

    // Placeholder: return simple response until LLM is integrated.
    const answer = context
      ? `Based on the document: ${context.slice(0, 500)}... [LLM integration pending]`
      : "No relevant information found.";

    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Ask error:", err);
    return NextResponse.json(
      { error: "Question answering failed" },
      { status: 500 }
    );
  }
}
