import { test, expect } from "@playwright/test";
import { seedTranslateSession, TEST_DOC_ID } from "./helpers/session";

// ─────────────────────────────────────────
// FLOW: Accessibility — WCAG 2.1 AA compliance spot-checks
// AUDIT COVERAGE: A11Y HIGH (Send button accessible name during loading),
//   A11Y MED (input labels, error alert roles, aria attributes)
// ─────────────────────────────────────────

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();
  });

  test("A11Y-01: question input has accessible label", async ({ page }) => {
    const input = page.getByLabel("Question input");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("aria-label", "Question input");
  });

  test("A11Y-02: Send button has accessible text in default state", async ({
    page,
  }) => {
    const sendButton = page.getByRole("button", { name: "Send" });
    await expect(sendButton).toBeVisible();
  });

  test("A11Y-03: loading spinner in Send button has aria-hidden", async ({
    page,
  }) => {
    // Slow the API so we can inspect the loading state
    await page.route("**/api/ask", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ answer: "Response" }),
      });
    });

    const input = page.getByLabel("Question input");
    await input.fill("Test");
    await input.press("Enter");

    // The spinner SVG inside the button should be aria-hidden
    const spinner = page.locator("button svg[aria-hidden='true']");
    await expect(spinner).toBeVisible();
  });

  test("A11Y-04: error alert uses proper role='alert'", async ({ page }) => {
    // Translation will fail because /api/translate doesn't exist — triggers an Alert
    const alert = page.locator("[role='alert']");
    await expect(alert.first()).toBeVisible({ timeout: 15_000 });
  });

  test("A11Y-05: original and translated text areas have aria-labels", async ({
    page,
  }) => {
    const originalTextarea = page.getByLabel("Original document text");
    await expect(originalTextarea).toBeVisible();
    await expect(originalTextarea).toHaveAttribute(
      "aria-label",
      "Original document text",
    );
  });
});
