import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OCRResult } from "@/types";

const { storedRecords, mockDb, resetStore } = vi.hoisted(() => {
  const storedRecords: Record<string, unknown>[] = [];
  const mockDb = {
    transaction(_store: string, _mode: string) {
      return {
        objectStore(_name: string) {
          return {
            getAll: async () => [...storedRecords],
            add: async (record: object) => {
              storedRecords.push(record as Record<string, unknown>);
            },
          };
        },
      };
    },
  };
  return {
    storedRecords,
    mockDb,
    resetStore: () => {
      storedRecords.length = 0;
    },
  };
});

vi.mock("@/lib/entitydb", () => ({
  getEntityDB: vi.fn(() => ({
    dbPromise: Promise.resolve(mockDb),
  })),
}));

import {
  buildCanonicalPersistPayload,
  persistOCRToEntityDB,
  getDocumentFromEntityDB,
  fileToDataUrl,
  EXTRACTED_DOCUMENT_ENTITY_KEY,
} from "./entitydb-persist";

function serverStyleOcr(docId: string): OCRResult {
  return {
    documentId: docId,
    fullText: "Hello world",
    blocks: [
      {
        id: "b1",
        documentId: docId,
        text: "Hello world",
        confidence: 1,
        page: 1,
      },
    ],
    language: "en",
  };
}

describe("buildCanonicalPersistPayload", () => {
  it("maps server-style OCR into Document, OCRBlock[], and FieldCandidate[]", async () => {
    const docId = "doc_test123";
    const createdAt = 1_700_000_000_000;
    const ocr = serverStyleOcr(docId);

    const { canonical, record } = await buildCanonicalPersistPayload({
      docId,
      filename: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      createdAt,
      ocr,
    });

    expect(canonical.document).toEqual({
      id: docId,
      filename: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      createdAt,
    });
    expect(canonical.ocr.documentId).toBe(docId);
    expect(canonical.ocr.blocks).toHaveLength(1);
    expect(canonical.ocr.blocks[0].documentId).toBe(docId);
    expect(canonical.files).toEqual([]);
    expect(canonical.extractedAt).toBe(createdAt);
    expect(canonical.updatedAt).toBe(createdAt);
    expect(record.entityKey).toBe(EXTRACTED_DOCUMENT_ENTITY_KEY);
    expect(record.text).toBe(canonical.ocr.fullText);
    expect(Array.isArray(record.vector)).toBe(true);
    expect((record.vector as number[]).length).toBe(384);
    expect("imageDataUrl" in record).toBe(false);
  });

  it("maps client-side OCR shape (single block) correctly", async () => {
    const docId = "doc_img";
    const fullText = "Scanned line";
    const ocr: OCRResult = {
      documentId: docId,
      fullText,
      blocks: [{ id: "b1", documentId: docId, text: fullText, confidence: 1 }],
    };

    const { canonical } = await buildCanonicalPersistPayload({
      docId,
      filename: "x.png",
      mimeType: "image/png",
      sizeBytes: 100,
      createdAt: 99,
      ocr,
    });

    expect(canonical.ocr.blocks).toHaveLength(1);
    expect(canonical.ocr.blocks[0].id).toBe("b1");
    expect(canonical.ocr.blocks[0].text).toBe(fullText);
  });

  it("creates FieldCandidate -> Document and FieldCandidate -> OCRBlock links", async () => {
    const docId = "doc_kv";
    const ocr: OCRResult = {
      documentId: docId,
      fullText: "Name: Jane Doe",
      blocks: [
        {
          id: "block_a",
          documentId: docId,
          text: "Name: Jane Doe",
          confidence: 0.9,
          page: 1,
        },
      ],
    };

    const { canonical } = await buildCanonicalPersistPayload({
      docId,
      filename: "doc.txt",
      mimeType: "text/plain",
      sizeBytes: 10,
      createdAt: 1,
      ocr,
    });

    const withBlock = canonical.fieldCandidates.filter((c) => c.blockId === "block_a");
    expect(withBlock.length).toBeGreaterThan(0);
    for (const c of canonical.fieldCandidates) {
      expect(c.documentId).toBe(docId);
      if (c.blockId) {
        expect(canonical.ocr.blocks.some((b) => b.id === c.blockId)).toBe(true);
      }
    }
  });
});

describe("fileToDataUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns undefined for non-image files", async () => {
    const file = new File(["x"], "x.pdf", { type: "application/pdf" });
    await expect(fileToDataUrl(file)).resolves.toBeUndefined();
  });

  it("returns a data URL for image files", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: ((ev: unknown) => void) | null = null;
      readAsDataURL(_blob: Blob) {
        this.result = "data:image/png;base64,QUJD";
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const file = new File([new Uint8Array([1, 2, 3])], "p.png", {
      type: "image/png",
    });
    await expect(fileToDataUrl(file)).resolves.toBe("data:image/png;base64,QUJD");
  });
});

describe("persistOCRToEntityDB and getDocumentFromEntityDB", () => {
  beforeEach(() => {
    resetStore();
    vi.stubGlobal("window", globalThis as Window & typeof globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes entityKey extracted_document and round-trips via getDocumentFromEntityDB", async () => {
    const docId = "doc_round";
    const createdAt = 42;
    await persistOCRToEntityDB({
      docId,
      filename: "f.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
      createdAt,
      ocr: serverStyleOcr(docId),
    });

    expect(storedRecords).toHaveLength(1);
    expect(storedRecords[0].entityKey).toBe(EXTRACTED_DOCUMENT_ENTITY_KEY);

    const back = await getDocumentFromEntityDB(docId);
    expect(back).not.toBeNull();
    expect(back!.document.id).toBe(docId);
    expect(back!.ocr.fullText).toBe("Hello world");
    expect(back!.fieldCandidates).toBeDefined();
  });

  it("stores imageDataUrl when file is an image", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL(_blob: Blob) {
        this.result = "data:image/jpeg;base64,WFhY";
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const docId = "doc_pic";
    const file = new File([new Uint8Array([9])], "shot.jpg", { type: "image/jpeg" });

    await persistOCRToEntityDB({
      docId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      createdAt: 1,
      ocr: {
        documentId: docId,
        fullText: "text",
        blocks: [{ id: "b1", documentId: docId, text: "text", confidence: 1 }],
      },
      file,
    });

    expect(storedRecords[0].imageDataUrl).toBe("data:image/jpeg;base64,WFhY");
    const back = await getDocumentFromEntityDB(docId);
    expect((back as Record<string, unknown> | null)?.imageDataUrl).toBe(
      "data:image/jpeg;base64,WFhY"
    );
  });
});

/* ═══════════════════════════════════════════
   PRINCIPAL ENGINEER AUDIT — entitydb-persist.test.ts 2026-03-24
   🔴 High: 0  🟡 Medium: 0  🔵 Low: 0
   ═══════════════════════════════════════════
   
   ✅ Principal Engineer Audit — No issues found.
   
   Good patterns observed:
   - Proper isolation with vi.hoisted for mock state
   - Comprehensive coverage: build payload, persist, retrieve, round-trip
   - Tests edge cases (non-image files, image data URL storage)
   - Clean afterEach cleanup with unstubAllGlobals
*/
