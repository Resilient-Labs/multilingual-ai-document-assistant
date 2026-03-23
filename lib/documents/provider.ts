/**
 * OCR provider interface and adapter boundary.
 * Abstracts OCR integration so it can be swapped for different vendors.
 */

import type { NormalizedBoundingBox } from "@/types";

export interface RawOCRBlock {
  text: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RawOCRPage {
  pageNumber: number;
  width: number;
  height: number;
  blocks: RawOCRBlock[];
  fullText: string;
}

export interface RawOCRResult {
  pages: RawOCRPage[];
  language?: string;
}

export interface OCRProviderError extends Error {
  code: "OCR_FAILURE";
  cause?: unknown;
}

export interface OCRProvider {
  extract(fileBuffer: ArrayBuffer, mimeType: string): Promise<RawOCRResult>;
}

export class MockOCRProvider implements OCRProvider {
  async extract(fileBuffer: ArrayBuffer, mimeType: string): Promise<RawOCRResult> {
    const fileSize = fileBuffer.byteLength;
    const isPdf = mimeType === "application/pdf";
    const pageCount = isPdf ? Math.max(1, Math.floor(fileSize / 50000)) : 1;

    const pages: RawOCRPage[] = [];

    for (let i = 0; i < pageCount; i++) {
      const pageWidth = 612;
      const pageHeight = 792;

      pages.push({
        pageNumber: i + 1,
        width: pageWidth,
        height: pageHeight,
        blocks: [
          {
            text: `Sample text block on page ${i + 1}`,
            confidence: 0.95,
            bbox: { x: 72, y: 72, width: 468, height: 24 },
          },
          {
            text: `Name: John Doe`,
            confidence: 0.92,
            bbox: { x: 72, y: 120, width: 200, height: 18 },
          },
          {
            text: `Date: 2026-03-15`,
            confidence: 0.94,
            bbox: { x: 72, y: 150, width: 180, height: 18 },
          },
          {
            text: `Amount: $1,234.56`,
            confidence: 0.91,
            bbox: { x: 72, y: 180, width: 160, height: 18 },
          },
        ],
        fullText: [
          `Sample text block on page ${i + 1}`,
          `Name: John Doe`,
          `Date: 2026-03-15`,
          `Amount: $1,234.56`,
        ].join("\n"),
      });
    }

    return {
      pages,
      language: "en",
    };
  }
}

export function normalizeBlockBbox(
  rawBbox: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number
): NormalizedBoundingBox {
  return {
    x: rawBbox.x / pageWidth,
    y: rawBbox.y / pageHeight,
    width: rawBbox.width / pageWidth,
    height: rawBbox.height / pageHeight,
  };
}

let _provider: OCRProvider | null = null;

export function getOCRProvider(): OCRProvider {
  if (!_provider) {
    _provider = new MockOCRProvider();
  }
  return _provider;
}

export function setOCRProvider(provider: OCRProvider): void {
  _provider = provider;
}
