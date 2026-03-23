/**
 * Normalize raw OCR provider output into canonical Team 1 entities.
 * Generates stable IDs and relationships for frontend persistence.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  Document,
  OCRBlock,
  OCRResult,
  ExtractedPage,
  ExtractedFile,
} from "@/types";
import type { RawOCRResult } from "./provider";
import { normalizeBlockBbox } from "./provider";
import type { ValidatedFile } from "./validation";

function generateBlockId(): string {
  return `block_${uuidv4()}`;
}

export interface NormalizedExtractionResult {
  document: Document;
  ocr: OCRResult;
  files: ExtractedFile[];
}

export function normalizeOCRResult(
  documentId: string,
  validatedFiles: ValidatedFile[],
  rawResults: RawOCRResult[]
): NormalizedExtractionResult {
  const allBlocks: OCRBlock[] = [];
  const files: ExtractedFile[] = [];
  const fullTextParts: string[] = [];
  let detectedLanguage: string | undefined;

  for (let fileIndex = 0; fileIndex < validatedFiles.length; fileIndex++) {
    const validatedFile = validatedFiles[fileIndex];
    const rawResult = rawResults[fileIndex];

    if (rawResult.language && !detectedLanguage) {
      detectedLanguage = rawResult.language;
    }

    const extractedPages: ExtractedPage[] = [];

    for (const rawPage of rawResult.pages) {
      const pageBlocks: OCRBlock[] = [];

      for (const rawBlock of rawPage.blocks) {
        const block: OCRBlock = {
          id: generateBlockId(),
          documentId,
          text: rawBlock.text,
          confidence: rawBlock.confidence,
          page: rawPage.pageNumber,
          bbox: normalizeBlockBbox(rawBlock.bbox, rawPage.width, rawPage.height),
        };

        pageBlocks.push(block);
        allBlocks.push(block);
      }

      fullTextParts.push(rawPage.fullText);

      extractedPages.push({
        pageNumber: rawPage.pageNumber,
        width: rawPage.width,
        height: rawPage.height,
        blocks: pageBlocks,
      });
    }

    files.push({
      fileIndex,
      filename: validatedFile.filename,
      mimeType: validatedFile.mimeType,
      sizeBytes: validatedFile.sizeBytes,
      pages: extractedPages,
    });
  }

  const totalSizeBytes = validatedFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
  const primaryFile = validatedFiles[0];

  const document: Document = {
    id: documentId,
    filename: primaryFile.filename,
    mimeType: primaryFile.mimeType,
    sizeBytes: totalSizeBytes,
    createdAt: Date.now(),
  };

  const ocr: OCRResult = {
    documentId,
    fullText: fullTextParts.join("\n\n"),
    blocks: allBlocks,
    language: detectedLanguage,
  };

  return { document, ocr, files };
}
