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
  text: string;
  confidence?: number;
  page?: number;
  bbox?: unknown;
}

// --- FieldCandidate (Team 1) ---

export interface FieldCandidate {
  key: string;
  value: string;
  confidence?: number;
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
  blocks: Array<{
    id: string;
    text: string;
    confidence?: number;
    page?: number;
    bbox?: unknown;
  }>;
  language?: string;
}
