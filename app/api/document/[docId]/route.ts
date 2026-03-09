import { NextRequest, NextResponse } from "next/server";
import { getWithParse } from "@/lib/redis";
import { REDIS_KEYS } from "@/lib/constants";

/**
 * GET /api/document/[docId]
 * Retrieve document metadata and OCR data from Redis.
 * Used when user reloads page, reopens document, or restores UI.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;

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

    return NextResponse.json(doc);
  } catch (err) {
    console.error("Get document error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve document" },
      { status: 500 }
    );
  }
}
