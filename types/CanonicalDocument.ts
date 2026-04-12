/**
 * Canonical document - aligns with OCR result and Document entity.
 * This is the shape stored in client-side EntityDB after extraction.
 */
import type {
  Document,
  OCRResult,
  ExtractedFile,
  FieldCandidate,
  SafetyAnalysisResponse,
} from './index'

export interface CanonicalDocument {
  document: Document
  ocr: OCRResult
  files: ExtractedFile[]
  fieldCandidates: FieldCandidate[]
  extractedAt: number
  updatedAt: number
  /** Client-only merge of POST /api/safety after extract (zero-retention). */
  safety?: SafetyAnalysisResponse
}
