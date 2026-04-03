import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────
// FLOW: API Security — /api/ask input validation, error handling, response shape
// AUDIT COVERAGE: SEC-01 (no auth — all calls succeed unauthenticated),
//   SEC-03 (no runtime validation), SEC-05 (reflected content)
// NOTE: These tests use Playwright's request context to call the API directly,
//   bypassing the browser. This mirrors what an attacker would do.
// ─────────────────────────────────────────

test.describe("/api/ask — Security", () => {
  test("SEC-01: rejects request with missing question field (400)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: { context: "some context but no question" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("question required");
  });

  test("SEC-02: handles malformed JSON body gracefully", async ({
    request,
  }) => {
    const response = await request.fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: "this is not valid json{{{",
    });

    // Next.js may return 400 (bad request) or 500 depending on how the body
    // parser handles the malformed input — both are acceptable error responses
    expect(response.status()).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test("SEC-03: accepts valid question + chunks payload (200)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: {
        question: "What is this about?",
        chunks: ["Chunk one content.", "Chunk two content."],
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.answer).toBeDefined();
    expect(typeof body.answer).toBe("string");
  });

  test("SEC-04: returns answer incorporating context when chunks provided", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: {
        question: "What is this?",
        chunks: ["The document discusses climate change impacts."],
      },
    });

    const body = await response.json();
    expect(body.answer).toContain("Based on the document");
    expect(body.answer).toContain("climate change");
  });

  test("SEC-05: returns fallback message when no context provided", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: { question: "Hello?" },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.answer).toContain("No relevant information found");
  });
});
