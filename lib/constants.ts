/**
 * Storage constraints and configuration.
 * Architecture: Privacy-first ephemeral storage.
 */

/** TTL in seconds: 7 days */
export const REDIS_TTL_SECONDS = 604800;

/** Max file size: 4.5 MB */
export const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;

/** Max OCR JSON size: 2 MB */
export const MAX_OCR_JSON_BYTES = 2 * 1024 * 1024;

/** Max chunks + embeddings size: 3 MB */
export const MAX_CHUNKS_EMBEDDINGS_BYTES = 3 * 1024 * 1024;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Redis key prefixes */
export const REDIS_KEYS = {
  doc: (docId: string) => `doc:${docId}`,
  chunks: (docId: string) => `chunks:${docId}`,
  embeddings: (docId: string) => `embeddings:${docId}`,
  conversation: (docId: string) => `conversation:${docId}`,
  file: (docId: string) => `file:${docId}`,
} as const;
