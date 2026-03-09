/**
 * Storage constraints and configuration.
 * Architecture: Zero-retention. All data in client (EntityDB).
 * Backend is stateless.
 */

/** Max file size: 4.5 MB */
export const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
