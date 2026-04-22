/**
 * Maps app `targetLang` values (upload / translate UI) to NLLB FLORES-200 style
 * codes expected by `facebook/nllb-200-distilled-600M` inference (`tgt_lang`).
 * Source language for `/api/translate` remains English → `eng_Latn`.
 */

/** Fixed source tag when the document is treated as English (current product rule). */
export const NLLB_SOURCE_ENGLISH = 'eng_Latn'

/**
 * App language key → NLLB target language tag.
 * Keys match `LANGUAGE_LABELS` / target options in the translate flow.
 */
export const APP_TO_NLLB_TARGET: Record<string, string> = {
  en: 'eng_Latn',
  es: 'spa_Latn',
  fr: 'fra_Latn',
  de: 'deu_Latn',
  zh: 'zho_Hans',
  'zh-TW': 'zho_Hant',
  ja: 'jpn_Jpan',
  ko: 'kor_Hang',
  pt: 'por_Latn',
  it: 'ita_Latn',
  ru: 'rus_Cyrl',
  ar: 'arb_Arab',
  hi: 'hin_Deva',
  nl: 'nld_Latn',
  pl: 'pol_Latn',
  sv: 'swe_Latn',
  tr: 'tur_Latn',
  vi: 'vie_Latn',
}

export function getNllbTargetCode(targetLang: string): string | undefined {
  return APP_TO_NLLB_TARGET[targetLang]
}
