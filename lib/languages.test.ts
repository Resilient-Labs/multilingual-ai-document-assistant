import { describe, it, expect } from "vitest";
import { DEEPL_LANG_MAP, LANGUAGE_LABELS, LANGUAGES } from "./languages";

describe("lib/languages", () => {
  it("every selectable target has a DeepL mapping and display label", () => {
    for (const { code } of LANGUAGES) {
      if (code === "auto") {
        expect(DEEPL_LANG_MAP[code]).toBeUndefined();
        continue;
      }
      expect(DEEPL_LANG_MAP[code]).toBeTruthy();
      expect(LANGUAGE_LABELS[code]).toBeTruthy();
    }
  });
});
