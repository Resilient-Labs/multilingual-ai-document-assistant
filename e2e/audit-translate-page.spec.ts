import { test, expect } from "@playwright/test";
import {
  seedTranslateSession,
  TEST_DOC_ID,
  TEST_SESSION,
} from "./helpers/session";
import {
  stubTranslateApiFailure,
  stubTranslateApiSuccess,
} from "./helpers/translateApi";

// ─────────────────────────────────────────
// FLOW: Translate Page — session hydration, layout, navigation
// AUDIT COVERAGE: PRINCIPAL MED-1 (sessionStorage transport),
//   A11Y MED (page title, aria-labels)
// Note: `/api/translate` is stubbed in every test so Playwright never calls
// Hugging Face. See e2e/helpers/translateApi.ts.
// ─────────────────────────────────────────

test.describe("Translate Page", () => {
  test.setTimeout(60_000);
  test("TRANS-01: shows 'Session expired' when no sessionStorage data", async ({
    page,
  }) => {
    await page.goto(`/translate/${TEST_DOC_ID}`);

    await expect(page.getByText("Session expired")).toBeVisible();
    await expect(
      page.getByText("No document data found. Please upload your document again."),
    ).toBeVisible();
  });

  test("TRANS-02: 'Back to upload' button navigates to home page", async ({
    page,
  }) => {
    await page.goto(`/translate/${TEST_DOC_ID}`);

    await page.getByRole("button", { name: /back to upload/i }).click();
    await page.waitForURL("/");
  });

  test("TRANS-03: loads and displays original document from sessionStorage", async ({
    page,
  }) => {
    await stubTranslateApiSuccess(page, "Texto traducido de prueba.");
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);

    const originalTextarea = page.getByLabel("Original document text");
    await expect(originalTextarea).toBeVisible();
    await expect(originalTextarea).toHaveValue(TEST_SESSION.fullText);
  });

  test("TRANS-04: header shows filename and language pair", async ({
    page,
  }) => {
    await stubTranslateApiSuccess(page, "Texto traducido de prueba.");
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);

    await expect(page.getByText(TEST_SESSION.filename)).toBeVisible();
    // Header shows "English → Spanish"; target the paragraph containing both
    const langPair = page.getByText("EnglishSpanish");
    await expect(langPair).toBeVisible();
  });

  test("TRANS-05: translation failure shows error alert", async ({ page }) => {
    // Deterministic upstream failure so the test exercises UI behavior, not
    // real Hugging Face health. The route now exists and calls NLLB; we stub
    // it to a 502 to reliably surface the error alert.
    await stubTranslateApiFailure(page, 502, {
      error: "Translation service returned an error",
    });
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);

    await expect(page.getByText("Translation failed")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Translation service returned an error"),
    ).toBeVisible();
  });
});
