import { NextResponse } from "next/server";
import { getWithParse } from "@/lib/redis";
import { REDIS_KEYS } from "@/lib/constants";

/**
 * POST /api/safety
 * Team 5: Detect red flags (scams, eviction notices, urgent financial docs).
 * Analyzes OCR JSON, fields, confidence scores.
 * Body: { docId: string }
 *
 * TODO: Implement safety detection logic.
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

    const doc = await getWithParse(REDIS_KEYS.doc(docId));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or expired" },
        { status: 404 }
      );
    }

    // TODO: Analyze OCR JSON for scams, eviction notices, urgent docs.
    const flags = {
      hasUrgentContent: false,
      hasEvictionNotice: false,
      hasScamIndicators: false,
      details: [] as string[],
    };

    return NextResponse.json({ flags });
  } catch (err) {
    console.error("Safety check error:", err);
    return NextResponse.json(
      { error: "Safety check failed" },
      { status: 500 }
    );
  }
}
