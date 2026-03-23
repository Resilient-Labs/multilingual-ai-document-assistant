import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAndValidateFiles } from "./validation";

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

describe("parseAndValidateFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns NO_FILES error when no files provided", async () => {
    const formData = new FormData();
    const request = createMockRequest(formData);

    const result = await parseAndValidateFiles(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("NO_FILES");
    }
  });

  it("accepts single file via 'file' field", async () => {
    const file = createMockFile("test.pdf", "application/pdf", 1024);
    const formData = new FormData();
    formData.append("file", file);
    const request = createMockRequest(formData);

    const result = await parseAndValidateFiles(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe("test.pdf");
    }
  });

  it("accepts multiple files via 'files' field", async () => {
    const file1 = createMockFile("test1.pdf", "application/pdf", 1024);
    const file2 = createMockFile("test2.png", "image/png", 2048);
    const formData = new FormData();
    formData.append("files", file1);
    formData.append("files", file2);
    const request = createMockRequest(formData);

    const result = await parseAndValidateFiles(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.files).toHaveLength(2);
    }
  });

  it("returns INVALID_FILE_TYPE for unsupported mime type", async () => {
    const file = createMockFile("test.txt", "text/plain", 1024);
    const formData = new FormData();
    formData.append("file", file);
    const request = createMockRequest(formData);

    const result = await parseAndValidateFiles(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("INVALID_FILE_TYPE");
      expect(result.error.details.filename).toBe("test.txt");
      expect(result.error.details.mimeType).toBe("text/plain");
    }
  });

  it("returns FILE_TOO_LARGE for oversized file", async () => {
    const size = 5 * 1024 * 1024;
    const file = createMockFile("large.pdf", "application/pdf", size);
    const formData = new FormData();
    formData.append("file", file);
    const request = createMockRequest(formData);

    const result = await parseAndValidateFiles(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("FILE_TOO_LARGE");
      expect(result.error.details.sizeBytes).toBe(size);
    }
  });

  it("returns TOO_MANY_FILES when exceeding limit", async () => {
    const formData = new FormData();
    for (let i = 0; i < 11; i++) {
      const file = createMockFile(`test${i}.pdf`, "application/pdf", 1024);
      formData.append("files", file);
    }
    const request = createMockRequest(formData);

    const result = await parseAndValidateFiles(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("TOO_MANY_FILES");
      expect(result.error.details.count).toBe(11);
      expect(result.error.details.maxFiles).toBe(10);
    }
  });

  it("accepts all allowed mime types", async () => {
    const allowedTypes = [
      { name: "test.pdf", type: "application/pdf" },
      { name: "test.jpg", type: "image/jpeg" },
      { name: "test.png", type: "image/png" },
      { name: "test.webp", type: "image/webp" },
    ];

    for (const { name, type } of allowedTypes) {
      const file = createMockFile(name, type, 1024);
      const formData = new FormData();
      formData.append("file", file);
      const request = createMockRequest(formData);

      const result = await parseAndValidateFiles(request);
      expect(result.success).toBe(true);
    }
  });
});
