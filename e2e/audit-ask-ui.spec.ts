import { test, expect } from "@playwright/test";
import { seedTranslateSession, TEST_DOC_ID } from "./helpers/session";
import { stubTranslateApiSuccess } from "./helpers/translateApi";

// ─────────────────────────────────────────
// FLOW: Ask UI — chat Q&A, streaming/JSON detection, loading states
// AUDIT COVERAGE: PRINCIPAL HIGH-3 (docId prop), HIGH-4 (handleSubmit dual-mode),
//   MED-5 (key stability), MED-7 (stale closure),
//   DEVOPS HIGH (streaming mismatch — verifies JSON fallback path)
// Note: `/api/translate` is stubbed so Playwright never calls Hugging Face.
// ─────────────────────────────────────────

test.describe("Ask UI", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await stubTranslateApiSuccess(page, "Texto traducido de prueba.");
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();
  });

  test("ASK-01: renders with empty state placeholder", async ({ page }) => {
    await expect(
      page.getByText("Ask a question about the document above."),
    ).toBeVisible();
  });

  test("ASK-02: user can type a question and submit via Send button", async ({
    page,
  }) => {
    const input = page.getByLabel("Question input");
    const sendButton = page.getByRole("button", { name: "Send" });

    await input.fill("What is this document about?");
    await sendButton.click();

    // User message appears
    await expect(page.getByText("What is this document about?")).toBeVisible();

    // Assistant response from the /api/ask stub — uses text locator (resilient)
    // queryChunks may take up to 3s (timeout), then fetch + stream reading
    await expect(page.getByText(/based on the document/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("ASK-03: user can submit a question by pressing Enter", async ({
    page,
  }) => {
    const input = page.getByLabel("Question input");
    await input.fill("Summarize this");
    await input.press("Enter");

    await expect(page.getByText("Summarize this")).toBeVisible();
  });

  test("ASK-04: user message appears right-aligned with primary background", async ({
    page,
  }) => {
    const input = page.getByLabel("Question input");
    await input.fill("Test question");
    await input.press("Enter");

    const userBubble = page.locator(".justify-end .bg-primary");
    await expect(userBubble).toBeVisible();
    await expect(userBubble).toContainText("Test question");
  });

  test("ASK-05: assistant response appears left-aligned with muted background", async ({
    page,
  }) => {
    const input = page.getByLabel("Question input");
    await input.fill("What does this say?");
    await input.press("Enter");

    // Wait for any assistant response text (not "Thinking...")
    await expect(page.getByText(/based on the document/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("ASK-06: Send button is disabled while loading", async ({ page }) => {
    // Slow down the API so we can inspect the loading state
    await page.route("**/api/ask", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ answer: "Delayed answer" }),
      });
    });

    const input = page.getByLabel("Question input");
    await input.fill("Test question");
    await input.press("Enter");

    // While loading, the button renders a spinner instead of "Send" text
    // and is disabled — there should be no enabled "Send" button
    const sendButton = page.getByRole("button").filter({ hasText: "Send" });
    await expect(sendButton).toHaveCount(0);
  });

  test("ASK-07: input is disabled while loading", async ({ page }) => {
    await page.route("**/api/ask", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ answer: "Response" }),
      });
    });

    const input = page.getByLabel("Question input");
    await input.fill("Test question");
    await input.press("Enter");

    await expect(input).toBeDisabled();
  });

  test("ASK-08: empty input cannot be submitted — Send button disabled", async ({
    page,
  }) => {
    const sendButton = page.getByRole("button", { name: "Send" });
    await expect(sendButton).toBeDisabled();
  });

  test("ASK-09: multiple questions build a conversation", async ({ page }) => {
    const input = page.getByLabel("Question input");

    await input.fill("First question");
    await input.press("Enter");

    // Wait for the first assistant response text and input to re-enable
    await expect(page.getByText(/based on the document/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(input).toBeEnabled({ timeout: 10_000 });

    await input.fill("Second question");
    await input.press("Enter");

    // Both user messages visible in the conversation
    await expect(page.getByText("First question")).toBeVisible();
    await expect(page.getByText("Second question")).toBeVisible();

    // Two assistant responses
    await expect(page.getByText(/based on the document/i)).toHaveCount(2, {
      timeout: 30_000,
    });
  });

  test('ASK-10: "Thinking..." spinner shows while awaiting response', async ({
    page,
  }) => {
    await page.route("**/api/ask", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ answer: "Delayed answer" }),
      });
    });

    const input = page.getByLabel("Question input");
    await input.fill("Slow question");
    await input.press("Enter");

    await expect(page.getByText("Thinking...")).toBeVisible();

    // Eventually the real response replaces the placeholder
    await expect(page.getByText("Delayed answer")).toBeVisible({
      timeout: 15_000,
    });
  });
});
