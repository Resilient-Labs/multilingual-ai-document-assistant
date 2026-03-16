/**
 * Shared error response helpers for document extraction routes.
 * Provides consistent JSON error shape across all Team 1 endpoints.
 */

import { NextResponse } from "next/server";
import type { ExtractionErrorCode, ExtractionErrorResponse } from "@/types";

export function errorResponse(
  error: string,
  code: ExtractionErrorCode,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ExtractionErrorResponse> {
  const body: ExtractionErrorResponse = { error, code };
  if (details) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export function noFilesError(): NextResponse<ExtractionErrorResponse> {
  return errorResponse("No files provided", "NO_FILES", 400);
}

export function invalidFileTypeError(
  filename: string,
  mimeType: string
): NextResponse<ExtractionErrorResponse> {
  return errorResponse(
    `Invalid file type: ${mimeType}. Allowed: PDF, JPEG, PNG, WebP.`,
    "INVALID_FILE_TYPE",
    400,
    { filename, mimeType }
  );
}

export function fileTooLargeError(
  filename: string,
  sizeBytes: number,
  maxBytes: number
): NextResponse<ExtractionErrorResponse> {
  return errorResponse(
    `File too large: ${filename}. Max ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`,
    "FILE_TOO_LARGE",
    400,
    { filename, sizeBytes, maxBytes }
  );
}

export function tooManyFilesError(
  count: number,
  maxFiles: number
): NextResponse<ExtractionErrorResponse> {
  return errorResponse(
    `Too many files: ${count}. Max ${maxFiles} files per request.`,
    "TOO_MANY_FILES",
    400,
    { count, maxFiles }
  );
}

export function ocrFailureError(
  message: string,
  details?: Record<string, unknown>
): NextResponse<ExtractionErrorResponse> {
  return errorResponse(
    `OCR processing failed: ${message}`,
    "OCR_FAILURE",
    500,
    details
  );
}

export function internalError(
  message = "Internal server error"
): NextResponse<ExtractionErrorResponse> {
  return errorResponse(message, "INTERNAL_ERROR", 500);
}
