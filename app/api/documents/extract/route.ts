import { NextResponse } from "next/server";
import { getWithParse } from "@/lib/redis";
import { REDIS_KEYS } from "@/lib/constants";
import type { RedisDocEntry } from "@/types";

/**
 * POST /api/documents/extract
 * Team 1: Return structured OCR JSON for a document.
 * Used for async OCR, reprocessing, or debugging.
 * Body: { docId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const docId = body?.docId as string | undefined;

    if (!docId) {
      return NextResponse.json(
        { error: "docId required" },
        { status: 400 }
      );
    }

    const doc = await getWithParse<RedisDocEntry>(REDIS_KEYS.doc(docId));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json(doc.ocr);
  } catch (err) {
    console.error("Extract error:", err);
    return NextResponse.json(
      { error: "Extract failed" },
      { status: 500 }
    );
  }
}
