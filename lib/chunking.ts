import type { OCRResult } from "@/types";

export const CHUNK_TARGET_SIZE = 500;
export const CHUNK_OVERLAP = 100;

/**
 * Returns the last ~n characters of text, trimmed to a word boundary.
 * If no word boundary is found, returns the last n characters.
 */
function lastNCharsAtWordBoundary(text: string, n: number): string {
  if (text.length <= n) return text.trim();
  const slice = text.slice(-n);
  const spaceIdx = slice.indexOf(" ");
  if (spaceIdx === -1) return slice;
  return slice.slice(spaceIdx).trim();
}

/**
 * Splits fullText using a sliding window when blocks are empty.
 * Target ~500 chars per chunk, ~100 char overlap, split at paragraph or sentence boundaries where possible.
 */
function fallbackChunkFullText(fullText: string): string[] {
  const chunks: string[] = [];
  const paragraphs = fullText.split(/\n\s*\n/);
  let buffer = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const toAdd = buffer ? ` ${trimmed}` : trimmed;
    if (buffer.length + toAdd.length <= CHUNK_TARGET_SIZE) {
      buffer = buffer ? buffer + " " + trimmed : trimmed;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      const overlap = lastNCharsAtWordBoundary(buffer, CHUNK_OVERLAP);
      buffer = overlap ? overlap + " " + trimmed : trimmed;
    } else {
      // Single paragraph exceeds target — split by sentences if possible
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      for (const sent of sentences) {
        const toAddSent = buffer ? ` ${sent}` : sent;
        if (buffer.length + toAddSent.length <= CHUNK_TARGET_SIZE) {
          buffer = buffer ? buffer + " " + sent : sent;
        } else {
          if (buffer) {
            chunks.push(buffer);
            const overlap = lastNCharsAtWordBoundary(buffer, CHUNK_OVERLAP);
            buffer = overlap ? overlap + " " + sent : sent;
          } else {
            chunks.push(sent);
          }
        }
      }
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

/**
 * Chunks OCR result into text segments for embedding.
 * Option D: Group by page, accumulate to ~500 chars, emit with overlap.
 */
export function chunkOCRResult(ocr: OCRResult): string[] {
  const blocks = ocr.blocks.filter((b) => b.text?.trim());

  if (blocks.length === 0 && ocr.fullText?.trim()) {
    return fallbackChunkFullText(ocr.fullText);
  }

  if (blocks.length === 0) return [];

  // Group blocks by page
  const byPage = new Map<number, typeof blocks>();
  for (const block of blocks) {
    const page = block.page ?? 0;
    const list = byPage.get(page) ?? [];
    list.push(block);
    byPage.set(page, list);
  }

  const pages = Array.from(byPage.keys()).sort((a, b) => a - b);
  const chunks: string[] = [];
  let buffer = "";

  for (const pageNum of pages) {
    const pageBlocks = byPage.get(pageNum)!;

    for (const block of pageBlocks) {
      const text = block.text.trim();
      if (!text) continue;

      // Oversized block: emit as its own chunk
      if (text.length > CHUNK_TARGET_SIZE) {
        if (buffer.trim()) {
          chunks.push(buffer.trim());
          buffer = "";
        }
        chunks.push(text);
        continue;
      }

      const toAdd = buffer ? ` ${text}` : text;
      if (buffer.length + toAdd.length <= CHUNK_TARGET_SIZE) {
        buffer = buffer ? buffer + " " + text : text;
        continue;
      }

      // Emit current buffer, seed next with overlap
      chunks.push(buffer.trim());
      const overlap = lastNCharsAtWordBoundary(buffer, CHUNK_OVERLAP);
      buffer = overlap ? overlap + " " + text : text;
    }

    // Page boundary: emit current buffer and seed next page with overlap
    if (buffer.trim()) {
      chunks.push(buffer.trim());
      const overlap = lastNCharsAtWordBoundary(buffer, CHUNK_OVERLAP);
      buffer = overlap;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}
