/**
 * Canonical document - aligns with OCR result and Document entity.
 */
import type { OCRResult } from "./index";

export interface CanonicalDocument {
  id: string;
  docId: string;
  filename: string;
  mimeType: string;
  ocr: OCRResult;
  createdAt: number;
  updatedAt: number;
}
