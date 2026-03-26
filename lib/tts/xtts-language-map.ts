import { TtsError } from "@/lib/tts/types";

const XTTS_LANGUAGE_MAP: Record<string, string> = {
  zh: "zh",
  "zh-TW": "zh",
  ko: "ko",
  pt: "pt",
  ru: "ru",
  ar: "ar",
  hi: "hi",
  pl: "pl",
  tr: "tr",
};

export function mapToXttsLanguage(targetLang: string): string {
  const xttsLanguage = XTTS_LANGUAGE_MAP[targetLang];
  if (!xttsLanguage) {
    throw new TtsError(
      `No XTTS language mapping available for: ${targetLang}`,
      400
    );
  }

  return xttsLanguage;
}
