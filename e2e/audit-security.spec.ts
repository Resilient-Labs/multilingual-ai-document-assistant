import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────
// FLOW: SECURITY — API-level baseline checks
// TESTS: Stub endpoint behavior, structured error responses
// AUDIT COVERAGE: SEC-1 (no auth — baseline), SEC-4 (stub endpoint),
//                 SEC-2 (validation on extract)
// ─────────────────────────────────────────

test.describe("Security Baseline", () => {
  test("SEC-01: Stub /api/upload returns 200 with { success: true } (known issue baseline)", async ({
    request,
  }) => {
    const response = await request.post("/api/upload");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test("SEC-02: /api/documents/extract returns structured error JSON for bad input", async ({
    request,
  }) => {
    const response = await request.post("/api/documents/extract", {
      multipart: {
        file: {
          name: "evil.html",
          mimeType: "text/html",
          buffer: Buffer.from("<script>alert('xss')</script>"),
        },
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("code");
    expect(typeof body.error).toBe("string");
    expect(typeof body.code).toBe("string");
    expect(body.code).toBe("INVALID_FILE_TYPE");
  });
});
