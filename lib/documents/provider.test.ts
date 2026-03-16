import { describe, it, expect } from "vitest";
import {
  MockOCRProvider,
  normalizeBlockBbox,
  getOCRProvider,
  setOCRProvider,
} from "./provider";
import type { OCRProvider, RawOCRResult } from "./provider";

describe("MockOCRProvider", () => {
  it("returns pages for image files", async () => {
    const provider = new MockOCRProvider();
    const buffer = new ArrayBuffer(1024);

    const result = await provider.extract(buffer, "image/png");

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
  });

  it("returns multiple pages for larger PDFs", async () => {
    const provider = new MockOCRProvider();
    const buffer = new ArrayBuffer(150000);

    const result = await provider.extract(buffer, "application/pdf");

    expect(result.pages.length).toBeGreaterThan(1);
  });

  it("returns blocks with text and confidence", async () => {
    const provider = new MockOCRProvider();
    const buffer = new ArrayBuffer(1024);

    const result = await provider.extract(buffer, "image/jpeg");

    expect(result.pages[0].blocks.length).toBeGreaterThan(0);
    expect(result.pages[0].blocks[0].text).toBeDefined();
    expect(result.pages[0].blocks[0].confidence).toBeGreaterThan(0);
  });

  it("returns fullText for each page", async () => {
    const provider = new MockOCRProvider();
    const buffer = new ArrayBuffer(1024);

    const result = await provider.extract(buffer, "image/png");

    expect(result.pages[0].fullText).toBeDefined();
    expect(result.pages[0].fullText.length).toBeGreaterThan(0);
  });

  it("returns language detection", async () => {
    const provider = new MockOCRProvider();
    const buffer = new ArrayBuffer(1024);

    const result = await provider.extract(buffer, "image/png");

    expect(result.language).toBe("en");
  });

  it("returns blocks with bounding boxes", async () => {
    const provider = new MockOCRProvider();
    const buffer = new ArrayBuffer(1024);

    const result = await provider.extract(buffer, "image/png");

    const block = result.pages[0].blocks[0];
    expect(block.bbox).toBeDefined();
    expect(block.bbox.x).toBeGreaterThanOrEqual(0);
    expect(block.bbox.y).toBeGreaterThanOrEqual(0);
    expect(block.bbox.width).toBeGreaterThan(0);
    expect(block.bbox.height).toBeGreaterThan(0);
  });
});

describe("normalizeBlockBbox", () => {
  it("normalizes coordinates to 0-1 range", () => {
    const rawBbox = { x: 50, y: 100, width: 200, height: 50 };
    const pageWidth = 400;
    const pageHeight = 500;

    const normalized = normalizeBlockBbox(rawBbox, pageWidth, pageHeight);

    expect(normalized.x).toBe(0.125);
    expect(normalized.y).toBe(0.2);
    expect(normalized.width).toBe(0.5);
    expect(normalized.height).toBe(0.1);
  });

  it("handles zero coordinates", () => {
    const rawBbox = { x: 0, y: 0, width: 100, height: 100 };

    const normalized = normalizeBlockBbox(rawBbox, 200, 200);

    expect(normalized.x).toBe(0);
    expect(normalized.y).toBe(0);
    expect(normalized.width).toBe(0.5);
    expect(normalized.height).toBe(0.5);
  });

  it("handles full page bbox", () => {
    const rawBbox = { x: 0, y: 0, width: 612, height: 792 };

    const normalized = normalizeBlockBbox(rawBbox, 612, 792);

    expect(normalized.x).toBe(0);
    expect(normalized.y).toBe(0);
    expect(normalized.width).toBe(1);
    expect(normalized.height).toBe(1);
  });
});

describe("getOCRProvider / setOCRProvider", () => {
  it("returns default MockOCRProvider", () => {
    const provider = getOCRProvider();
    expect(provider).toBeInstanceOf(MockOCRProvider);
  });

  it("allows setting custom provider", async () => {
    const customResult: RawOCRResult = {
      pages: [
        {
          pageNumber: 1,
          width: 100,
          height: 100,
          blocks: [{ text: "Custom", confidence: 1, bbox: { x: 0, y: 0, width: 100, height: 100 } }],
          fullText: "Custom",
        },
      ],
      language: "custom",
    };

    const customProvider: OCRProvider = {
      extract: async () => customResult,
    };

    setOCRProvider(customProvider);
    const provider = getOCRProvider();
    const result = await provider.extract(new ArrayBuffer(0), "image/png");

    expect(result.language).toBe("custom");

    setOCRProvider(new MockOCRProvider());
  });
});
