/**
 * Shared TypeScript interfaces for the Multilingual AI Document Assistant.
 * Architecture: Privacy-first ephemeral storage (Redis TTL).
 */

// --- OCR / Document types ---

export interface OCRBlock {
  text: string;
  page?: number;
  confidence?: number;
  [key: string]: unknown;
}

export interface OCRResult {
  documentId: string;
  fullText: string;
  blocks: OCRBlock[];
  language?: string;
  [key: string]: unknown;
}

export interface DocumentMetadata {
  docId: string;
  fileName: string;
  mimeType: string;
  createdAt: number;
}

// --- Chunking ---

export interface TextChunk {
  chunkId: number;
  page: number;
  text: string;
}

// --- Embeddings ---

export interface ChunkEmbedding {
  chunkId: number;
  vector: number[];
}

// --- Conversation ---

export interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  message?: string;
}

// --- Redis document structure ---

export interface RedisDocEntry {
  docId: string;
  fileName: string;
  createdAt: number;
  ocr: OCRResult;
}

// --- IndexedDB schemas (client-side) ---

export interface IndexedDBDocument {
  docId: string;
  fileName: string;
  mimeType: string;
  createdAt: number;
}

export interface IndexedDBSession {
  docId: string;
  lastOpened: number;
}

export interface IndexedDBChatHistory {
  docId: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
}
