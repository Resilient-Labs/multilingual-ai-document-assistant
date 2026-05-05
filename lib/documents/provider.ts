/**
 * OCR provider interface and adapter boundary.
 * Abstracts OCR integration so it can be swapped for different vendors.
 */

import type { NormalizedBoundingBox } from '@/types'

export interface RawOCRBlock {
  text: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface RawOCRPage {
  pageNumber: number
  width: number
  height: number
  blocks: RawOCRBlock[]
  fullText: string
}

export interface RawOCRResult {
  pages: RawOCRPage[]
  language?: string
}

export interface OCRProviderError extends Error {
  code: 'OCR_FAILURE'
  cause?: unknown
}

export interface OCRProvider {
  extract(fileBuffer: ArrayBuffer, mimeType: string): Promise<RawOCRResult>
}

function mockOCRBlock(): RawOCRBlock {
  return {
    text: 'Mock extracted text',
    confidence: 0.95,
    bbox: { x: 50, y: 100, width: 200, height: 50 },
  }
}

export class MockOCRProvider implements OCRProvider {
  async extract(
    fileBuffer: ArrayBuffer,
    mimeType: string
  ): Promise<RawOCRResult> {
    const block = mockOCRBlock()
    const fullText = block.text
    const page1 = {
      pageNumber: 1,
      width: 612,
      height: 792,
      blocks: [block],
      fullText,
    }

    if (mimeType === 'application/pdf' && fileBuffer.byteLength > 100_000) {
      return {
        pages: [
          page1,
          {
            pageNumber: 2,
            width: 612,
            height: 792,
            blocks: [mockOCRBlock()],
            fullText,
          },
        ],
        language: 'en',
      }
    }

    return {
      pages: [page1],
      language: 'en',
    }
  }
}

export class TesseractOCRProvider implements OCRProvider {
  async extract(fileBuffer: ArrayBuffer): Promise<RawOCRResult> {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')

    try {
      const buffer = Buffer.from(fileBuffer)
      const { data } = await worker.recognize(buffer, {}, {
        text: true,
        blocks: true,
      } as Parameters<typeof worker.recognize>[2])

      type RawLine = {
        text: string
        confidence: number
        bbox: { x0: number; y0: number; x1: number; y1: number }
      }
      const rawLines = (
        (data.blocks ?? []) as Array<{
          paragraphs?: Array<{ lines?: RawLine[] }>
        }>
      )
        .flatMap((b) => b.paragraphs ?? [])
        .flatMap((p) => p.lines ?? [])
        .filter((l) => l.text?.trim().length > 0)

      const blocks: RawOCRBlock[] = rawLines.map((line) => ({
        text: line.text.trim(),
        confidence: line.confidence / 100,
        bbox: {
          x: line.bbox.x0,
          y: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0,
        },
      }))

      const pageWidth = blocks.length
        ? Math.max(...blocks.map((b) => b.bbox.x + b.bbox.width))
        : 1000
      const pageHeight = blocks.length
        ? Math.max(...blocks.map((b) => b.bbox.y + b.bbox.height))
        : 1000

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
        language: 'eng',
      }
    } finally {
      await worker.terminate()
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
  }
}

let _provider: OCRProvider | null = null

export function getOCRProvider(): OCRProvider {
  if (!_provider) {
    _provider = new MockOCRProvider()
  }
  return _provider
}

export function setOCRProvider(provider: OCRProvider): void {
  _provider = provider
}
