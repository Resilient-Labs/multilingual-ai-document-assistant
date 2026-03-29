/**
 * Storage constraints and configuration.
 * Architecture: Zero-retention. All data in client (EntityDB).
 * Backend is stateless.
 */

/** Max file size: 4.5 MB */
export const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;

/** Max number of files per extraction request */
export const MAX_FILES_PER_REQUEST = 10;

/** Per-route character caps — prevents cost-amplification attacks on paid providers. */
export const MAX_TRANSLATE_CHARS = 10_000;
export const MAX_SUMMARIZE_CHARS = 50_000;
export const MAX_ASK_QUESTION_CHARS = 1_000;
export const MAX_ASK_CONTEXT_CHARS = 50_000;
export const MAX_SAFETY_CHARS = 50_000;

/** Outbound HTTP timeouts (ms) — prevent indefinite hangs on third-party APIs. */
export const DEEPL_TIMEOUT_MS = 10_000;
export const OPENROUTER_TIMEOUT_MS = 30_000;
export const DEEPGRAM_TIMEOUT_MS = 15_000;
export const REPLICATE_META_TIMEOUT_MS = 10_000;
export const REPLICATE_RUN_TIMEOUT_MS = 90_000;
export const AUDIO_DOWNLOAD_TIMEOUT_MS = 30_000;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
