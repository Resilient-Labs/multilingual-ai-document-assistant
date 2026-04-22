import type { Page } from "@playwright/test";

/** Stable mock for `/api/translate` so e2e does not call Hugging Face. */
export async function stubTranslateApiSuccess(
  page: Page,
  translatedText: string,
) {
  await page.route("**/api/translate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ translatedText }),
    });
  });
}

export async function stubTranslateApiFailure(
  page: Page,
  status: number = 502,
  errorBody: Record<string, string> = {
    error: "Translation service returned an error",
  },
) {
  await page.route("**/api/translate", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(errorBody),
    });
  });
}
