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
  async extract(_fileBuffer: ArrayBuffer, _mimeType: string): Promise<RawOCRResult> {
    return {
      pages: [{ pageNumber: 1, width: 612, height: 792, blocks: [], fullText: "" }],
      language: "en",
    };
  }
}

export class TesseractOCRProvider implements OCRProvider {
  async extract(fileBuffer: ArrayBuffer): Promise<RawOCRResult> {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");

    try {
      const buffer = Buffer.from(fileBuffer);
      const { data } = await worker.recognize(buffer, {}, { text: true, blocks: true } as Parameters<typeof worker.recognize>[2]);

      const rawLines = (data.blocks ?? [])
        .flatMap((b: { paragraphs?: { lines?: unknown[] }[] }) => b.paragraphs ?? [])
        .flatMap((p: { lines?: unknown[] }) => p.lines ?? [])
        .filter((l: { text?: string }) => l.text?.trim().length > 0);

      const blocks: RawOCRBlock[] = (rawLines as Array<{
        text: string;
        confidence: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }>).map((line) => ({
        text: line.text.trim(),
        confidence: line.confidence / 100,
        bbox: {
          x: line.bbox.x0,
          y: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0,
        },
      }));

      const pageWidth = blocks.length
        ? Math.max(...blocks.map((b) => b.bbox.x + b.bbox.width))
        : 1000;
      const pageHeight = blocks.length
        ? Math.max(...blocks.map((b) => b.bbox.y + b.bbox.height))
        : 1000;

      return {
        pages: [
          {
            pageNumber: 1,
            width: pageWidth,
            height: pageHeight,
            blocks,
            fullText: data.text,
          },
        ],
        language: "eng",
      };
    } finally {
      await worker.terminate();
    }
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
