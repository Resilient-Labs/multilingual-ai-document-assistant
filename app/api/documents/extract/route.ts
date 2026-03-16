import { NextResponse } from "next/server";
import { generateDocumentId } from "@/lib/documentId";
import {
  parseAndValidateFiles,
  getOCRProvider,
  normalizeOCRResult,
  extractFieldCandidates,
  errorResponse,
  noFilesError,
  invalidFileTypeError,
  fileTooLargeError,
  tooManyFilesError,
  ocrFailureError,
  internalError,
} from "@/lib/documents";
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_REQUEST } from "@/lib/constants";
import type { ExtractionResponse } from "@/types";
import type { RawOCRResult } from "@/lib/documents/provider";

/**
 * POST /api/documents/extract
 *
 * Team 1: Stateless OCR extraction endpoint.
 * Accepts multipart form-data with `files[]` or `file` field.
 * Returns normalized entity-ready JSON for frontend persistence in EntityDB.
 *
 * Request:
 *   Content-Type: multipart/form-data
 *   Body: files[] (multiple) or file (single)
 *
 * Response:
 *   200: ExtractionResponse with Document, OCRResult, ExtractedFiles, FieldCandidates
 *   400: ExtractionErrorResponse for validation errors
 *   500: ExtractionErrorResponse for OCR or server errors
 *
 * Server stores nothing. All persistence happens in the client.
 */
export async function POST(request: Request) {
  try {
    const validationResult = await parseAndValidateFiles(request);

    if (!validationResult.success) {
      const { error } = validationResult;

      switch (error.type) {
        case "NO_FILES":
          return noFilesError();
        case "INVALID_FILE_TYPE":
          return invalidFileTypeError(
            error.details.filename ?? "unknown",
            error.details.mimeType ?? "unknown"
          );
        case "FILE_TOO_LARGE":
          return fileTooLargeError(
            error.details.filename ?? "unknown",
            error.details.sizeBytes ?? 0,
            error.details.maxBytes ?? MAX_FILE_SIZE_BYTES
          );
        case "TOO_MANY_FILES":
          return tooManyFilesError(
            error.details.count ?? 0,
            error.details.maxFiles ?? MAX_FILES_PER_REQUEST
          );
        default:
          return errorResponse(error.message, "INTERNAL_ERROR", 400);
      }
    }

    const { files: validatedFiles } = validationResult;
    const documentId = generateDocumentId();
    const ocrProvider = getOCRProvider();

    const rawResults: RawOCRResult[] = [];

    for (const validatedFile of validatedFiles) {
      try {
        const buffer = await validatedFile.file.arrayBuffer();
        const rawResult = await ocrProvider.extract(buffer, validatedFile.mimeType);
        rawResults.push(rawResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown OCR error";
        return ocrFailureError(message, { filename: validatedFile.filename });
      }
    }

    const { document, ocr, files } = normalizeOCRResult(
      documentId,
      validatedFiles,
      rawResults
    );

    const fieldCandidates = extractFieldCandidates(documentId, ocr.blocks);

    const response: ExtractionResponse = {
      document,
      ocr,
      files,
      fieldCandidates,
      extractedAt: Date.now(),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Extraction failed:", err);
    return internalError("Extraction failed");
  }
}
