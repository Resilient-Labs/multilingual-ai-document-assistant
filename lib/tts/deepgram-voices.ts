import type { Gender, SpanishAccent } from "@/lib/tts/types";

const NON_SPANISH_MODELS: Record<string, Record<Gender, string>> = {
  en: {
    masculine: "aura-2-apollo-en",
    feminine: "aura-2-thalia-en",
  },
  de: {
    masculine: "aura-2-julius-de",
    feminine: "aura-2-viktoria-de",
  },
  fr: {
    masculine: "aura-2-hector-fr",
    feminine: "aura-2-agathe-fr",
  },
  it: {
    masculine: "aura-2-dionisio-it",
    feminine: "aura-2-livia-it",
  },
  ja: {
    masculine: "aura-2-fujin-ja",
    feminine: "aura-2-izanami-ja",
  },
  nl: {
    masculine: "aura-2-sander-nl",
    feminine: "aura-2-rhea-nl",
  },
};

const SPANISH_MODELS: Record<SpanishAccent, Record<Gender, string>> = {
  argentine: {
    // Deepgram does not currently provide an Argentine masculine voice.
    masculine: "aura-2-aquila-es",
    feminine: "aura-2-antonia-es",
  },
  colombian: {
    // Deepgram does not currently provide a Colombian masculine voice.
    masculine: "aura-2-aquila-es",
    feminine: "aura-2-celeste-es",
  },
  "latin-american": {
    masculine: "aura-2-aquila-es",
    feminine: "aura-2-selena-es",
  },
  mexican: {
    masculine: "aura-2-javier-es",
    feminine: "aura-2-estrella-es",
  },
  peninsular: {
    masculine: "aura-2-nestor-es",
    feminine: "aura-2-carina-es",
  },
};

export const DEEPGRAM_SUPPORTED_LANGUAGES = [
  "nl",
  "en",
  "fr",
  "de",
  "it",
  "ja",
  "es",
] as const;

export function isDeepgramLanguage(targetLang: string): boolean {
  return DEEPGRAM_SUPPORTED_LANGUAGES.includes(
    targetLang as (typeof DEEPGRAM_SUPPORTED_LANGUAGES)[number]
  );
}

export function resolveAuraModel(
  targetLang: string,
  gender: Gender,
  spanishAccent: SpanishAccent = "latin-american"
): string {
  if (targetLang === "es") {
    return SPANISH_MODELS[spanishAccent][gender];
  }

  const languageVoices = NON_SPANISH_MODELS[targetLang];
  if (!languageVoices) {
    throw new Error(`No Deepgram voice mapping for language: ${targetLang}`);
  }

  return languageVoices[gender];
}
