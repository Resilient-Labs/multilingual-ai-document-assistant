/**
 * Canonical document type - aligns with OCR result structure.
 * Used for document metadata and OCR-derived content.
 */
import type { OCRResult } from "./index";

export interface CanonicalDocument {
  id: string;
  docId: string;
  fileName: string;
  ocr: OCRResult;
  createdAt: number;
  updatedAt: number;
}
