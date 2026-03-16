/**
 * Entity model for the Multilingual AI Document Assistant.
 * Architecture: Zero-retention. All data in client (EntityDB).
 * Backend is stateless.
 *
 * Entity graph:
 * Document
 * ├── OCRBlock → FieldCandidate
 * ├── Chunk → Embedding
 * ├── Summary
 * ├── RiskFlag
 * ├── Language
 * └── ChatSession → ChatMessage
 */

// --- Document (root) ---

export interface Document {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

// --- OCRBlock (Team 1) ---

export interface OCRBlock {
  id: string;
  documentId: string;
  text: string;
  confidence?: number;
  page?: number;
  bbox?: NormalizedBoundingBox;
}

// --- FieldCandidate (Team 1) ---

export interface FieldCandidate {
  id: string;
  documentId: string;
  blockId?: string;
  key: string;
  value: string;
  confidence?: number;
}

// --- BoundingBox (Team 1) ---

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- NormalizedBoundingBox (Team 1) ---
// Coordinates are normalized to 0-1 range relative to page dimensions

export interface NormalizedBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}


// --- Chunk (Team 3) ---

export interface Chunk {
  id: string;
  text: string;
  tokenCount?: number;
}

// --- Embedding (Team 3) ---

export interface Embedding {
  vector: number[];
  model?: string;
}

// --- Summary (Team 2) ---

export interface Summary {
  text: string;
  generatedAt: number;
  model?: string;
}

// --- ChatSession (Team 3) ---

export interface ChatSession {
  sessionId: string;
  startedAt: number;
}

// --- ChatMessage (Team 3) ---

export interface ChatMessage {
  role: "user" | "assistant";
  message: string;
  timestamp: number;
}

// --- Language (Team 4) ---

export interface Language {
  detected?: string;
  userPreferred?: string;
  translationEnabled?: boolean;
}

// --- RiskFlag (Team 5) ---

export interface RiskFlag {
  category: string;
  severity: "low" | "medium" | "high";
  explanation?: string;
  detectedAt: number;
}

// --- OCR API response (from stateless backend) ---

export interface OCRResult {
  documentId: string;
  fullText: string;
  blocks: OCRBlock[];
  language?: string;
}

// --- Team 1 Extraction Request/Response Contracts ---

export interface ExtractedPage {
  pageNumber: number;
  width: number;
  height: number;
  blocks: OCRBlock[];
}

export interface ExtractedFile {
  fileIndex: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pages: ExtractedPage[];
}

export interface ExtractionResponse {
  document: Document;
  ocr: OCRResult;
  files: ExtractedFile[];
  fieldCandidates: FieldCandidate[];
  extractedAt: number;
}

export interface ExtractionErrorResponse {
  error: string;
  code: ExtractionErrorCode;
  details?: Record<string, unknown>;
}

export type ExtractionErrorCode =
  | "NO_FILES"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "OCR_FAILURE"
  | "INTERNAL_ERROR";
