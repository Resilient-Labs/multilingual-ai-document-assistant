import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────
// FLOW: CHAT-UI ACCESSIBILITY — WCAG 2.1 AA for QAPanel
// TESTS: Headings, landmarks, live regions, speaker semantics, ARIA
// AUDIT COVERAGE: A11Y-1, A11Y-2, A11Y-3, A11Y-4, A11Y-5, A11Y-6, A11Y-7
// ─────────────────────────────────────────

test.describe("QAPanel Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/document/test-session-a11y");
    await page.waitForSelector(
      '[aria-label="Question input"], [placeholder="Ask a question about your document"]',
      { timeout: 10000 }
    );
  });

  test("A11Y-01: Panel title uses a semantic heading element (A11Y-1, WCAG 1.3.1)", async ({
    page,
  }) => {
    const heading = page.getByRole("heading", { name: /document q&a/i });
    await expect(heading).toBeVisible();

    const tagName = await heading.evaluate((el) => el.tagName.toLowerCase());
    expect(["h1", "h2", "h3", "h4", "h5", "h6"]).toContain(tagName);
  });

  test("A11Y-02: QAPanel is wrapped in a landmark region (A11Y-1, WCAG 1.3.1)", async ({
    page,
  }) => {
    const qaSection = page.locator(
      'section:has([aria-label="Question input"]), [role="region"]:has([aria-label="Question input"]), [role="complementary"]:has([aria-label="Question input"])'
    );

    await expect(qaSection).toBeVisible();
  });

  test("A11Y-03: Chat messages have speaker role semantics for assistive tech (A11Y-2, WCAG 1.3.1)", async ({
    page,
  }) => {
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: [
          `data: ${JSON.stringify({ type: "start", messageId: "test-msg" })}`,
          `data: ${JSON.stringify({ type: "text-start", id: "test-part" })}`,
          `data: ${JSON.stringify({ type: "text-delta", id: "test-part", delta: "Test answer from AI" })}`,
          `data: ${JSON.stringify({ type: "text-end", id: "test-part" })}`,
          `data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}`,
          "data: [DONE]",
        ]
          .map((e) => `${e}\n\n`)
          .join(""),
      })
    );

    const input = page.getByPlaceholder("Ask a question about your document");
    await input.fill("What is this about?");
    await page.getByRole("button", { name: /send question/i }).click();

    const userBubble = page.locator('[data-role="user"]');
    await expect(userBubble.first()).toBeVisible({ timeout: 15000 });

    const hasDataRole =
      (await page.locator("[data-role='user']").count()) > 0 ||
      (await page.locator("[data-role='assistant']").count()) > 0;
    const hasAriaLabel =
      (await page.locator("[aria-label*='User message']").count()) > 0 ||
      (await page.locator("[aria-label*='Assistant message']").count()) > 0;

    expect(hasDataRole || hasAriaLabel).toBe(true);
  });

  test("A11Y-04: Streaming/new messages are announced via aria-live region (A11Y-3, WCAG 4.1.3)", async ({
    page,
  }) => {
    const qaContainer = page.locator(
      'section[aria-labelledby="qa-panel-title"]'
    );
    const liveInQA = qaContainer.locator(
      '[aria-live="polite"], [aria-live="assertive"], [role="log"], [role="status"]'
    );

    const qaCount = await liveInQA.count();
    expect(qaCount).toBeGreaterThan(0);
  });

  test("A11Y-05: Send button icon SVG is aria-hidden (A11Y-5, WCAG 1.1.1)", async ({
    page,
  }) => {
    const sendBtn = page.getByRole("button", { name: /send question/i });
    await expect(sendBtn).toBeVisible();

    const svg = sendBtn.locator("svg");
    const ariaHidden = await svg.getAttribute("aria-hidden");
    expect(ariaHidden).toBe("true");
  });

  test("A11Y-06: Scroll sentinel div is aria-hidden (A11Y-6, WCAG 4.1.2)", async ({
    page,
  }) => {
    const chatArea = page
      .locator('section[aria-labelledby="qa-panel-title"]');
    const emptyDivs = chatArea.locator("div[aria-hidden='true']:not([class]):not([role])");

    const count = await emptyDivs.count();
    expect(count).toBeGreaterThan(0);
  });

  test("A11Y-07: Question input has a visible label or is programmatically labeled (A11Y-7)", async ({
    page,
  }) => {
    const input = page.getByPlaceholder("Ask a question about your document");
    await expect(input).toBeVisible();

    const ariaLabel = await input.getAttribute("aria-label");
    const ariaLabelledby = await input.getAttribute("aria-labelledby");
    const id = await input.getAttribute("id");

    const hasVisibleLabel =
      ariaLabelledby !== null ||
      (id !== null && (await page.locator(`label[for="${id}"]`).count()) > 0);

    expect(ariaLabel || hasVisibleLabel).toBeTruthy();
  });

  test("A11Y-08: Spinner and Thinking text are not both announced redundantly (A11Y-4, WCAG 4.1.2)", async ({
    page,
  }) => {
    await page.route("**/api/ask", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ type: "start", messageId: "m1" })}\n\ndata: ${JSON.stringify({ type: "text-start", id: "p1" })}\n\ndata: ${JSON.stringify({ type: "text-delta", id: "p1", delta: "Answer" })}\n\ndata: ${JSON.stringify({ type: "text-end", id: "p1" })}\n\ndata: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\ndata: [DONE]\n\n`,
      });
    });

    const input = page.getByPlaceholder("Ask a question about your document");
    await input.fill("Test question");
    await page.getByRole("button", { name: /send question/i }).click();

    const thinkingArea = page.locator("text=Thinking");
    if (await thinkingArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      const thinkingEl = thinkingArea.first();
      const ariaHidden = await thinkingEl.getAttribute("aria-hidden");
      expect(ariaHidden).toBe("true");
    }
  });
});
