import type { Page } from "@playwright/test";

export interface TranslateSession {
  fullText: string;
  filename: string;
  sourceLang: string;
  targetLang: string;
}

export const TEST_DOC_ID = "test-doc-123";

export const TEST_SESSION: TranslateSession = {
  fullText:
    "This is a test document with sample content for translation and question answering. " +
    "It contains multiple sentences so the Ask UI has meaningful context to work with. " +
    "The document discusses immigration paperwork and includes several paragraphs of text.",
  filename: "test-document.pdf",
  sourceLang: "en",
  targetLang: "es",
};

/**
 * Navigate to the app origin, seed sessionStorage with a translate session,
 * then return so the caller can navigate to `/translate/{docId}`.
 */
export async function seedTranslateSession(
  page: Page,
  docId: string = TEST_DOC_ID,
  session: TranslateSession = TEST_SESSION,
) {
  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)),
    { key: `translate-${docId}`, value: session },
  );
}
