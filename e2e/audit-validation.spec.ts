import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────
// FLOW: VALIDATION — Server-side input validation
// TESTS: File size, MIME type, missing file enforcement
// AUDIT COVERAGE: H1 (contract mismatch — now fixed), SEC-2 (MIME validation)
// ─────────────────────────────────────────

test.describe("Upload Validation (API)", () => {
  test("VAL-01: Extract API rejects missing file with 400 and NO_FILES code", async ({
    request,
  }) => {
    const response = await request.post("/api/documents/extract", {
      multipart: {},
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.code).toBe("NO_FILES");
  });

  test("VAL-02: Extract API rejects unsupported MIME type with INVALID_FILE_TYPE", async ({
    request,
  }) => {
    const response = await request.post("/api/documents/extract", {
      multipart: {
        file: {
          name: "malicious.exe",
          mimeType: "application/x-msdownload",
          buffer: Buffer.from("fake-executable-content"),
        },
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("INVALID_FILE_TYPE");
    expect(body.error).toContain("Invalid file type");
  });

  test("VAL-03: Extract API rejects oversized file with FILE_TOO_LARGE", async ({
    request,
  }) => {
    const fiveMB = Buffer.alloc(5 * 1024 * 1024, "x");

    const response = await request.post("/api/documents/extract", {
      multipart: {
        file: {
          name: "huge.pdf",
          mimeType: "application/pdf",
          buffer: fiveMB,
        },
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("FILE_TOO_LARGE");
    expect(body.error).toContain("too large");
  });

  test("VAL-04: Extract API accepts valid PDF and returns ExtractionResponse", async ({
    request,
  }) => {
    const response = await request.post("/api/documents/extract", {
      multipart: {
        file: {
          name: "test.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("PDF-content-placeholder"),
        },
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.document).toBeDefined();
    expect(body.document.id).toBeTruthy();
    expect(body.document.filename).toBe("test.pdf");
    expect(body.ocr).toBeDefined();
    expect(body.ocr.fullText).toBeTruthy();
    expect(body.ocr.blocks).toBeInstanceOf(Array);
    expect(body.files).toBeInstanceOf(Array);
    expect(body.fieldCandidates).toBeInstanceOf(Array);
    expect(body.extractedAt).toBeGreaterThan(0);
  });
});
