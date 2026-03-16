import { NextResponse } from "next/server";
import { generateDocumentId } from "@/lib/documentId";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "@/lib/constants";
import type { OCRResult } from "@/types";

/**
 * POST /api/documents/upload
 * Team 1: Stateless. Accept file, run OCR, return structured JSON.
 * Client stores result in EntityDB. Server stores nothing.
 *
 * TODO: Integrate actual OCR service (e.g. Tesseract, cloud OCR API).
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

    const docId = generateDocumentId();

    // TODO: Replace with real OCR. Pass file buffer to OCR service.
    const ocrResult: OCRResult = {
      documentId: docId,
      fullText: `[OCR placeholder for ${file.name}]`,
      blocks: [
        {
          id: "b1",
          documentId: docId,
          text: `[OCR placeholder for ${file.name}]`,
          confidence: 0.9,
        },
      ],
      language: "en",
    };

    return NextResponse.json({
      docId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      createdAt: Date.now(),
      ocr: ocrResult,
    });
  } catch {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
