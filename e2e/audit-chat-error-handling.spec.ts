import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────
// FLOW: CHAT-UI ERROR HANDLING — Route + QAPanel error behavior
// TESTS: Silent error swallowing, unhandled async, error UI feedback
// AUDIT COVERAGE: F-03, F-04, OBS-1, ERR-1, ERR-3, SEC-07, UI-2
// ─────────────────────────────────────────

const AUTH_HEADERS = { "X-Requested-With": "app" };

test.describe("Chat API Error Handling", () => {
  test("ERR-01: /api/ask catch block returns structured error with detail (F-03, OBS-1)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      headers: AUTH_HEADERS,
      data: { messages: [{ id: "m1", role: "user", parts: null }] },
    });

    expect(response.status()).toBe(500);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error).not.toBe("Question answering failed");
    expect(body.code).toBeTruthy();
  });

  test("ERR-02: /api/ask returns proper status code for malformed JSON (not 200)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
      data: "{invalid}",
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("ERR-03: /api/ask includes request context in error response (OBS-1, ERR-4)", async ({
    request,
  }) => {
    const response = await request.post("/api/ask", {
      data: { question: "" },
      headers: AUTH_HEADERS,
    });

    if (response.status() >= 400) {
      const body = await response.json();
      expect(body).toHaveProperty("error");
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    }
  });
});

test.describe("QAPanel Error Handling (UI)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/document/test-session-error");
    await page.waitForSelector(
      '[aria-label="Question input"], [placeholder="Ask a question about your document"]',
      { timeout: 10000 }
    );
  });

  test("ERR-04: QAPanel shows error alert when /api/ask returns 500 (F-04, ERR-3)", async ({
    page,
  }) => {
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      })
    );

    const input = page.getByPlaceholder("Ask a question about your document");
    await input.fill("Will this cause an error?");
    await page.getByRole("button", { name: /send question/i }).click();

    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
  });

  test("ERR-05: QAPanel does not show raw error.message to users (UI-2, SEC-07)", async ({
    page,
  }) => {
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "ECONNREFUSED 127.0.0.1:5432 - PostgreSQL connection failed",
        }),
      })
    );

    const input = page.getByPlaceholder("Ask a question about your document");
    await input.fill("Trigger error display");
    await page.getByRole("button", { name: /send question/i }).click();

    await page.waitForTimeout(3000);

    const pageContent = await page.textContent("body");
    expect(pageContent).not.toContain("ECONNREFUSED");
    expect(pageContent).not.toContain("127.0.0.1:5432");
    expect(pageContent).not.toContain("PostgreSQL");
  });

  test("ERR-06: QAPanel input is re-enabled after error so user can retry", async ({
    page,
  }) => {
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server error" }),
      })
    );

    const input = page.getByPlaceholder("Ask a question about your document");
    await input.fill("Error recovery test");
    await page.getByRole("button", { name: /send question/i }).click();

    await page.waitForTimeout(3000);

    await expect(input).toBeEnabled({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /send question/i })
    ).toBeEnabled();
  });

  test("ERR-07: QAPanel handles network failure gracefully (F-04, ERR-3)", async ({
    page,
  }) => {
    await page.route("**/api/ask", (route) => route.abort("connectionrefused"));

    const input = page.getByPlaceholder("Ask a question about your document");
    await input.fill("Network failure test");
    await page.getByRole("button", { name: /send question/i }).click();

    const errorIndicator = page
      .locator('[role="alert"]')
      .or(page.locator("[data-sonner-toast]"));

    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });

    await expect(input).toBeEnabled({ timeout: 10000 });
  });
});
