import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────
// FLOW: CHAT-UI SECURITY — API-level checks for /api/ask
// TESTS: Authentication, input validation, payload limits, info leakage
// AUDIT COVERAGE: F-01, F-02, SEC-01, SEC-02, SEC-04, SEC-05, SEC-06
// ─────────────────────────────────────────

const AUTH_HEADERS = { "X-Requested-With": "app" };

test.describe("Chat API Security (/api/ask)", () => {
  test("SEC-01: /api/ask rejects unauthenticated POST with 401 (F-01, SEC-01, SEC-1)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: {
        question: "What is this document about?",
        chunks: ["Some context text."],
      },
    });

    expect(response.status()).toBe(401);
  });

  test("SEC-02: /api/ask validates request body schema — rejects non-object payload (F-02, SEC-02)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: "this is not valid JSON object",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
    });

    expect([400, 422]).toContain(response.status());
  });

  test("SEC-03: /api/ask returns 400 for missing messages and question", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: { unrelated: "field" },
      headers: AUTH_HEADERS,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("SEC-04: /api/ask enforces payload size limits on chunks array (SEC-06)", async ({
    request,
  }) => {
    const largeChunks = Array.from({ length: 200 }, (_, i) =>
      `Chunk ${i}: ${"x".repeat(5000)}`
    );

    const response = await request.post("/api/ask", {
      data: {
        question: "Test question",
        chunks: largeChunks,
      },
      headers: AUTH_HEADERS,
    });

    expect([400, 413]).toContain(response.status());
  });

  test("SEC-05: /api/ask enforces limits on messages array length (F-02)", async ({
    request,
  }) => {
    const manyMessages = Array.from({ length: 500 }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: `Message ${i} content` }],
    }));

    const response = await request.post("/api/ask", {
      data: { messages: manyMessages, chunks: [] },
      headers: AUTH_HEADERS,
    });

    expect([400, 413]).toContain(response.status());
  });

  test("SEC-06: /api/ask fallback does not leak infrastructure details (SEC-05)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: { question: "Hello" },
      headers: AUTH_HEADERS,
    });

    if (response.status() === 200) {
      const text = await response.text();
      expect(text).not.toContain("OPENAI_API_KEY");
      expect(text).not.toContain(".env");
    }
  });

  test("SEC-07: /api/ask applies rate limiting (SEC-04, PERF-1)", async ({
    request,
  }) => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request.post("/api/ask", {
          data: { question: "Rate limit test" },
        })
      )
    );

    const statuses = responses.map((r) => r.status());
    const hasRateLimit = statuses.some((s) => s === 429);
    expect(hasRateLimit).toBe(true);
  });
});
