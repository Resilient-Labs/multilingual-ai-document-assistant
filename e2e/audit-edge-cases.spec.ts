import { test, expect } from "@playwright/test";
import { seedTranslateSession, TEST_DOC_ID } from "./helpers/session";

// ─────────────────────────────────────────
// FLOW: Edge Cases — validation, malformed data, API errors
// AUDIT COVERAGE: PRINCIPAL MED-1 (sessionStorage fragility),
//   DEVOPS HIGH (streaming mismatch), PATTERNS MED (error handling)
// ─────────────────────────────────────────

test.describe("Edge Cases", () => {
  test.setTimeout(60_000);
  test("EDGE-01: whitespace-only input cannot be submitted", async ({
    page,
  }) => {
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    const input = page.getByLabel("Question input");
    const sendButton = page.getByRole("button", { name: "Send" });

    await input.fill("   ");
    await expect(sendButton).toBeDisabled();
  });

  test("EDGE-02: translate page handles invalid sessionStorage JSON gracefully", async ({
    page,
  }) => {
    // Seed sessionStorage with unparseable junk
    await page.goto("/");
    await page.evaluate(
      (key) => sessionStorage.setItem(key, "not-valid-json{{{"),
      `translate-${TEST_DOC_ID}`,
    );

    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Session expired")).toBeVisible();
  });

  test("EDGE-03: Ask UI handles API 500 error gracefully", async ({
    page,
  }) => {
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // Intercept /api/ask to return a 500
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      }),
    );

    const input = page.getByLabel("Question input");
    await input.fill("Will this fail?");
    await input.press("Enter");

    // Error message appears in an alert
    await expect(page.getByText("Internal server error")).toBeVisible({
      timeout: 10_000,
    });

    // The user message persists, but the placeholder assistant message is removed
    await expect(page.getByText("Will this fail?")).toBeVisible();

    // Input re-enables after error so user can retry
    await expect(input).toBeEnabled({ timeout: 5_000 });
  });
});
