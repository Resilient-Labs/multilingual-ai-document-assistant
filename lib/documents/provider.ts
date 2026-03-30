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

      type RawLine = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
      const rawLines = ((data.blocks ?? []) as Array<{ paragraphs?: Array<{ lines?: RawLine[] }> }>)
        .flatMap((b) => b.paragraphs ?? [])
        .flatMap((p) => p.lines ?? [])
        .filter((l) => l.text?.trim().length > 0);

      const blocks: RawOCRBlock[] = rawLines.map((line) => ({
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

/**
 * Extracts text from PDF, DOCX, DOC, and TXT files.
 * Returns a single-page RawOCRResult with the full text and no bounding boxes.
 */
export class DocumentTextProvider implements OCRProvider {
  private static readonly DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  private static readonly DOC_MIME = "application/msword";

  async extract(fileBuffer: ArrayBuffer, mimeType: string): Promise<RawOCRResult> {
    const text = await this.extractText(fileBuffer, mimeType);
    return {
      pages: [
        {
          pageNumber: 1,
          width: 612,
          height: 792,
          blocks: text.trim().length > 0
            ? [{ text: text.trim(), confidence: 1, bbox: { x: 0, y: 0, width: 612, height: 792 } }]
            : [],
          fullText: text,
        },
      ],
      language: "en",
    };
  }

  private async extractText(buf: ArrayBuffer, mime: string): Promise<string> {
    if (mime === "text/plain") {
      return new TextDecoder().decode(buf);
    }

    if (mime === "application/pdf") {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buf));
      return Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text);
    }

    if (mime === DocumentTextProvider.DOCX_MIME) {
      const mammoth = await import("mammoth");
      const result = await mammoth.default.extractRawText({ buffer: Buffer.from(buf) });
      return result.value;
    }

    if (mime === DocumentTextProvider.DOC_MIME) {
      const WordExtractor = (await import("word-extractor")).default;
      const extractor = new WordExtractor();
      const doc = await extractor.extract(Buffer.from(buf));
      return doc.getBody();
    }

    throw new Error(`DocumentTextProvider: unsupported MIME type "${mime}"`);
  }
}

/**
 * Routes extraction to the appropriate provider based on MIME type.
 * Images → TesseractOCRProvider, documents → DocumentTextProvider.
 */
export class CompositeOCRProvider implements OCRProvider {
  private imageProvider: OCRProvider;
  private textProvider: OCRProvider;

  constructor(
    imageProvider?: OCRProvider,
    textProvider?: OCRProvider
  ) {
    this.imageProvider = imageProvider ?? new TesseractOCRProvider();
    this.textProvider = textProvider ?? new DocumentTextProvider();
  }

  async extract(fileBuffer: ArrayBuffer, mimeType: string): Promise<RawOCRResult> {
    if (mimeType.startsWith("image/")) {
      return this.imageProvider.extract(fileBuffer, mimeType);
    }
    return this.textProvider.extract(fileBuffer, mimeType);
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
