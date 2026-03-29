/**
 * Canonical app language definitions: UI labels, selector entries, and DeepL codes.
 * @see https://developers.deepl.com/docs/resources/supported-languages
 */

export interface LanguageDefinition {
  code: string;
  label: string;
  deeplTarget: string | null;
  /** Shown on translate session headers when different from selector label (e.g. auto). */
  sessionLabel?: string;
}

const DEFINITIONS: LanguageDefinition[] = [
  {
    code: "auto",
    label: "Detect language",
    deeplTarget: null,
    sessionLabel: "Detected",
  },
  { code: "en", label: "English", deeplTarget: "EN-US" },
  { code: "es", label: "Spanish", deeplTarget: "ES" },
  { code: "fr", label: "French", deeplTarget: "FR" },
  { code: "de", label: "German", deeplTarget: "DE" },
  { code: "zh", label: "Chinese (Simplified)", deeplTarget: "ZH-HANS" },
  { code: "zh-TW", label: "Chinese (Traditional)", deeplTarget: "ZH-HANT" },
  { code: "ja", label: "Japanese", deeplTarget: "JA" },
  { code: "ko", label: "Korean", deeplTarget: "KO" },
  { code: "pt", label: "Portuguese", deeplTarget: "PT-PT" },
  { code: "it", label: "Italian", deeplTarget: "IT" },
  { code: "ru", label: "Russian", deeplTarget: "RU" },
  { code: "ar", label: "Arabic", deeplTarget: "AR" },
  { code: "hi", label: "Hindi", deeplTarget: "HI" },
  { code: "nl", label: "Dutch", deeplTarget: "NL" },
  { code: "pl", label: "Polish", deeplTarget: "PL" },
  { code: "sv", label: "Swedish", deeplTarget: "SV" },
  { code: "tr", label: "Turkish", deeplTarget: "TR" },
  { code: "vi", label: "Vietnamese", deeplTarget: "VI" },
];

/** Source + target dropdown entries (`auto` first). */
export const LANGUAGES: Array<{ code: string; label: string }> = DEFINITIONS.map(
  ({ code, label }) => ({ code, label }),
);

/** Inline / session display names (e.g. "Detected" for auto). */
export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  DEFINITIONS.map((d) => [d.code, d.sessionLabel ?? d.label]),
);

/** App `targetLang` → DeepL `target_lang` (excludes `auto`). */
export const DEEPL_LANG_MAP: Record<string, string> = Object.fromEntries(
  DEFINITIONS.flatMap((d) =>
    d.deeplTarget != null ? [[d.code, d.deeplTarget]] as const : [],
  ),
);
