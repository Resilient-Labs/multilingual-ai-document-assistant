import { describe, it, expect } from "vitest";
import { normalizeOCRResult } from "./normalize";
import type { ValidatedFile } from "./validation";
import type { RawOCRResult } from "./provider";

function createValidatedFile(
  filename: string,
  mimeType: string,
  sizeBytes: number
): ValidatedFile {
  return {
    file: new File([new ArrayBuffer(sizeBytes)], filename, { type: mimeType }),
    filename,
    mimeType,
    sizeBytes,
  };
}

describe("normalizeOCRResult", () => {
  it("creates document with correct metadata", () => {
    const documentId = "doc_test123";
    const validatedFiles: ValidatedFile[] = [
      createValidatedFile("test.pdf", "application/pdf", 1024),
    ];
    const rawResults: RawOCRResult[] = [
      {
        pages: [
          {
            pageNumber: 1,
            width: 612,
            height: 792,
            blocks: [],
            fullText: "",
          },
        ],
        language: "en",
      },
    ];

    const result = normalizeOCRResult(documentId, validatedFiles, rawResults);

    expect(result.document.id).toBe(documentId);
    expect(result.document.filename).toBe("test.pdf");
    expect(result.document.mimeType).toBe("application/pdf");
    expect(result.document.sizeBytes).toBe(1024);
    expect(result.document.createdAt).toBeGreaterThan(0);
  });

  it("normalizes bbox coordinates to 0-1 range", () => {
    const documentId = "doc_test123";
    const validatedFiles: ValidatedFile[] = [
      createValidatedFile("test.pdf", "application/pdf", 1024),
    ];
    const rawResults: RawOCRResult[] = [
      {
        pages: [
          {
            pageNumber: 1,
            width: 100,
            height: 200,
            blocks: [
              {
                text: "Test",
                confidence: 0.95,
                bbox: { x: 25, y: 50, width: 50, height: 100 },
              },
            ],
            fullText: "Test",
          },
        ],
      },
    ];

    const result = normalizeOCRResult(documentId, validatedFiles, rawResults);

    const block = result.ocr.blocks[0];
    expect(block.bbox).toBeDefined();
    expect(block.bbox!.x).toBe(0.25);
    expect(block.bbox!.y).toBe(0.25);
    expect(block.bbox!.width).toBe(0.5);
    expect(block.bbox!.height).toBe(0.5);
  });

  it("assigns unique IDs to blocks", () => {
    const documentId = "doc_test123";
    const validatedFiles: ValidatedFile[] = [
      createValidatedFile("test.pdf", "application/pdf", 1024),
    ];
    const rawResults: RawOCRResult[] = [
      {
        pages: [
          {
            pageNumber: 1,
            width: 612,
            height: 792,
            blocks: [
              { text: "Block 1", confidence: 0.9, bbox: { x: 0, y: 0, width: 100, height: 20 } },
              { text: "Block 2", confidence: 0.9, bbox: { x: 0, y: 20, width: 100, height: 20 } },
            ],
            fullText: "Block 1\nBlock 2",
          },
        ],
      },
    ];

    const result = normalizeOCRResult(documentId, validatedFiles, rawResults);

    expect(result.ocr.blocks).toHaveLength(2);
    expect(result.ocr.blocks[0].id).not.toBe(result.ocr.blocks[1].id);
    expect(result.ocr.blocks[0].id).toMatch(/^block_/);
  });

  it("sets documentId on all blocks", () => {
    const documentId = "doc_test123";
    const validatedFiles: ValidatedFile[] = [
      createValidatedFile("test.pdf", "application/pdf", 1024),
    ];
    const rawResults: RawOCRResult[] = [
      {
        pages: [
          {
            pageNumber: 1,
            width: 612,
            height: 792,
            blocks: [
              { text: "Block 1", confidence: 0.9, bbox: { x: 0, y: 0, width: 100, height: 20 } },
            ],
            fullText: "Block 1",
          },
        ],
      },
    ];

    const result = normalizeOCRResult(documentId, validatedFiles, rawResults);

    expect(result.ocr.blocks[0].documentId).toBe(documentId);
  });

  it("handles multiple files", () => {
    const documentId = "doc_test123";
    const validatedFiles: ValidatedFile[] = [
      createValidatedFile("file1.pdf", "application/pdf", 1024),
      createValidatedFile("file2.png", "image/png", 2048),
    ];
    const rawResults: RawOCRResult[] = [
      {
        pages: [
          { pageNumber: 1, width: 612, height: 792, blocks: [], fullText: "File 1 text" },
        ],
      },
      {
        pages: [
          { pageNumber: 1, width: 800, height: 600, blocks: [], fullText: "File 2 text" },
        ],
      },
    ];

    const result = normalizeOCRResult(documentId, validatedFiles, rawResults);

    expect(result.files).toHaveLength(2);
    expect(result.files[0].filename).toBe("file1.pdf");
    expect(result.files[1].filename).toBe("file2.png");
    expect(result.document.sizeBytes).toBe(3072);
  });

  it("combines full text from all pages", () => {
    const documentId = "doc_test123";
    const validatedFiles: ValidatedFile[] = [
      createValidatedFile("test.pdf", "application/pdf", 1024),
    ];
    const rawResults: RawOCRResult[] = [
      {
        pages: [
          { pageNumber: 1, width: 612, height: 792, blocks: [], fullText: "Page 1 text" },
          { pageNumber: 2, width: 612, height: 792, blocks: [], fullText: "Page 2 text" },
        ],
      },
    ];

    const result = normalizeOCRResult(documentId, validatedFiles, rawResults);

    expect(result.ocr.fullText).toContain("Page 1 text");
    expect(result.ocr.fullText).toContain("Page 2 text");
  });

  it("extracts language from raw result", () => {
    const documentId = "doc_test123";
    const validatedFiles: ValidatedFile[] = [
      createValidatedFile("test.pdf", "application/pdf", 1024),
    ];
    const rawResults: RawOCRResult[] = [
      {
        pages: [{ pageNumber: 1, width: 612, height: 792, blocks: [], fullText: "" }],
        language: "es",
      },
    ];

    const result = normalizeOCRResult(documentId, validatedFiles, rawResults);

    expect(result.ocr.language).toBe("es");
  });
});
