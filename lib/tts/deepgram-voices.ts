const DEEPGRAM_LANGUAGES = new Set([
  "en", "es", "fr", "de", "pt", "it", "nl", "hi", "ja", "ko", "pl", "ru",
  "sv", "tr", "zh",
]);

export function isDeepgramLanguage(lang: string): boolean {
  return DEEPGRAM_LANGUAGES.has(lang);
}
