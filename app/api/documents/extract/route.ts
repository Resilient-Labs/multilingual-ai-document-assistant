import { NextResponse } from "next/server";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "@/lib/constants";
import type { OCRResult } from "@/types";

/**
 * POST /api/documents/extract
 * Team 1: Stateless. Accept file, run OCR, return structured OCR JSON.
 * Used for async OCR, reprocessing, or debugging.
 * Client stores result in EntityDB. Server stores nothing.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 4.5 MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, JPEG, PNG, WebP." },
        { status: 400 }
      );
    }

    // TODO: Replace with real OCR.
    const ocrResult: OCRResult = {
      documentId: "",
      fullText: `[OCR placeholder for ${file.name}]`,
      blocks: [
        {
          id: "b1",
          text: `[OCR placeholder for ${file.name}]`,
          confidence: 0.9,
        },
      ],
      language: "en",
    };

    return NextResponse.json(ocrResult);
  } catch {
    return NextResponse.json(
      { error: "Extract failed" },
      { status: 500 }
    );
  }
}
