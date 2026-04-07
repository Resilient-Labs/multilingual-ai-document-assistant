import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { setOCRProvider, MockOCRProvider } from "@/lib/documents/provider";
import type { OCRProvider } from "@/lib/documents/provider";
import type { ExtractionResponse, ExtractionErrorResponse } from "@/types";

function createMockFile(
  name: string,
  type: string,
  size: number
): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

function createMockRequest(formData: FormData): Request {
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as Request;
}

describe("POST /api/documents/extract", () => {
  beforeEach(() => {
    setOCRProvider(new MockOCRProvider());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("valid upload", () => {
    it("returns 200 with extraction response for valid single file", async () => {
      const file = createMockFile("test.pdf", "application/pdf", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionResponse;

      expect(response.status).toBe(200);
      expect(body.document).toBeDefined();
      expect(body.document.id).toMatch(/^doc_/);
      expect(body.document.filename).toBe("test.pdf");
      expect(body.ocr).toBeDefined();
      expect(body.ocr.documentId).toBe(body.document.id);
      expect(body.files).toBeDefined();
      expect(body.fieldCandidates).toBeDefined();
      expect(body.extractedAt).toBeGreaterThan(0);
    });

    it("returns 200 with extraction response for multiple files", async () => {
      const file1 = createMockFile("test1.pdf", "application/pdf", 1024);
      const file2 = createMockFile("test2.png", "image/png", 2048);
      const formData = new FormData();
      formData.append("files", file1);
      formData.append("files", file2);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionResponse;

      expect(response.status).toBe(200);
      expect(body.files).toHaveLength(2);
    });

    it("returns normalized bbox coordinates", async () => {
      const file = createMockFile("test.png", "image/png", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionResponse;

      expect(body.ocr.blocks.length).toBeGreaterThan(0);
      const block = body.ocr.blocks[0];
      expect(block.bbox).toBeDefined();
      expect(block.bbox!.x).toBeGreaterThanOrEqual(0);
      expect(block.bbox!.x).toBeLessThanOrEqual(1);
    });

    it("returns stable IDs for frontend persistence", async () => {
      const file = createMockFile("test.pdf", "application/pdf", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionResponse;

      expect(body.document.id).toMatch(/^doc_/);
      expect(body.ocr.blocks[0].id).toMatch(/^block_/);
      expect(body.ocr.blocks[0].documentId).toBe(body.document.id);
    });
  });

  describe("invalid file type", () => {
    it("returns 400 for unsupported file type", async () => {
      const file = createMockFile("test.txt", "text/plain", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionErrorResponse;

      expect(response.status).toBe(400);
      expect(body.error).toContain("Invalid file type");
      expect(body.code).toBe("INVALID_FILE_TYPE");
    });
  });

  describe("oversized file", () => {
    it("returns 400 for file exceeding size limit", async () => {
      const size = 5 * 1024 * 1024;
      const file = createMockFile("large.pdf", "application/pdf", size);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionErrorResponse;

      expect(response.status).toBe(400);
      expect(body.error).toContain("too large");
      expect(body.code).toBe("FILE_TOO_LARGE");
    });
  });

  describe("too many files", () => {
    it("returns 400 when exceeding file count limit", async () => {
      const formData = new FormData();
      for (let i = 0; i < 11; i++) {
        const file = createMockFile(`test${i}.pdf`, "application/pdf", 1024);
        formData.append("files", file);
      }
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionErrorResponse;

      expect(response.status).toBe(400);
      expect(body.error).toContain("Too many files");
      expect(body.code).toBe("TOO_MANY_FILES");
    });
  });

  describe("no files", () => {
    it("returns 400 when no files provided", async () => {
      const formData = new FormData();
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionErrorResponse;

      expect(response.status).toBe(400);
      expect(body.error).toContain("No files");
      expect(body.code).toBe("NO_FILES");
    });
  });

  describe("OCR failure", () => {
    it("returns 500 when OCR provider fails", async () => {
      const failingProvider: OCRProvider = {
        extract: async () => {
          throw new Error("OCR service unavailable");
        },
      };
      setOCRProvider(failingProvider);

      const file = createMockFile("test.pdf", "application/pdf", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionErrorResponse;

      expect(response.status).toBe(500);
      expect(body.error).toContain("OCR processing failed");
      expect(body.code).toBe("OCR_FAILURE");
    });
  });

  describe("normalized response shape", () => {
    it("includes all required fields in response", async () => {
      const file = createMockFile("test.pdf", "application/pdf", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionResponse;

      expect(body).toHaveProperty("document");
      expect(body).toHaveProperty("ocr");
      expect(body).toHaveProperty("files");
      expect(body).toHaveProperty("fieldCandidates");
      expect(body).toHaveProperty("extractedAt");

      expect(body.document).toHaveProperty("id");
      expect(body.document).toHaveProperty("filename");
      expect(body.document).toHaveProperty("mimeType");
      expect(body.document).toHaveProperty("sizeBytes");
      expect(body.document).toHaveProperty("createdAt");

      expect(body.ocr).toHaveProperty("documentId");
      expect(body.ocr).toHaveProperty("fullText");
      expect(body.ocr).toHaveProperty("blocks");
    });

    it("field candidates have correct structure", async () => {
      const file = createMockFile("test.pdf", "application/pdf", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionResponse;

      if (body.fieldCandidates.length > 0) {
        const candidate = body.fieldCandidates[0];
        expect(candidate).toHaveProperty("id");
        expect(candidate).toHaveProperty("documentId");
        expect(candidate).toHaveProperty("key");
        expect(candidate).toHaveProperty("value");
      }
    });

    it("extracted files have correct structure", async () => {
      const file = createMockFile("test.pdf", "application/pdf", 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const response = await POST(request);
      const body = (await response.json()) as ExtractionResponse;

      expect(body.files).toHaveLength(1);
      const extractedFile = body.files[0];
      expect(extractedFile).toHaveProperty("fileIndex");
      expect(extractedFile).toHaveProperty("filename");
      expect(extractedFile).toHaveProperty("mimeType");
      expect(extractedFile).toHaveProperty("sizeBytes");
      expect(extractedFile).toHaveProperty("pages");
    });
  });
});
