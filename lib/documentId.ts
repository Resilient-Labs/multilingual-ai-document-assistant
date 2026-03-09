import { v4 as uuidv4 } from "uuid";

/**
 * Generate a cryptographically secure document ID.
 * Format: doc_{uuidv4}
 */
export function generateDocumentId(): string {
  return `doc_${uuidv4()}`;
}
