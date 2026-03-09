import { NextResponse } from "next/server";
import { generateDocumentId } from "@/lib/documentId";
import { redis, setWithTTL } from "@/lib/redis";
import { REDIS_KEYS } from "@/lib/constants";
import type { OCRResult, RedisDocEntry } from "@/types";

const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * POST /api/documents/upload
 * Team 1: Accept file, run OCR pipeline, store in Redis, return OCR JSON.
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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 4.5 MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, JPEG, PNG, WebP." },
        { status: 400 }
      );
    }

    const docId = generateDocumentId();

    // TODO: Replace with real OCR. Pass file buffer to OCR service.
    // const buffer = await file.arrayBuffer();

    const ocrResult: OCRResult = {
      documentId: docId,
      fullText: `[OCR placeholder for ${file.name}]`,
      blocks: [{ text: `[OCR placeholder for ${file.name}]` }],
      language: "en",
    };

    if (!redis) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 503 }
      );
    }

    const docEntry: RedisDocEntry = {
      docId,
      fileName: file.name,
      createdAt: Date.now(),
      ocr: ocrResult,
    };

    await setWithTTL(REDIS_KEYS.doc(docId), docEntry);

    return NextResponse.json({
      docId,
      fileName: file.name,
      ocr: ocrResult,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
