import type { Chunk } from "@/types";

/**
 * Splits document text into overlapping chunks for RAG.
 * Pure function — safe for client and server.
 */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; chunkOverlap?: number }
): Chunk[] {
  const chunkSize = options?.chunkSize ?? 500;
  const chunkOverlap = options?.chunkOverlap ?? 100;

  if (text.length === 0) {
    return [];
  }

  if (text.length <= chunkSize) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return [];
    }
    return [
      {
        id: "chunk_0",
        text: trimmed,
        tokenCount: Math.ceil(trimmed.length / 4),
      },
    ];
  }

  const stride = Math.max(1, chunkSize - chunkOverlap);
  const chunks: Chunk[] = [];
  let emittedIndex = 0;

  for (let start = 0; start < text.length; start += stride) {
    const end = Math.min(start + chunkSize, text.length);
    const trimmed = text.slice(start, end).trim();
    if (trimmed.length > 0) {
      chunks.push({
        id: `chunk_${emittedIndex}`,
        text: trimmed,
        tokenCount: Math.ceil(trimmed.length / 4),
      });
      emittedIndex += 1;
    }
    if (end >= text.length) {
      break;
    }
  }

  return chunks;
}