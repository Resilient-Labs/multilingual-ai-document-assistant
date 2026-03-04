import type en from "@/dictionaries/en.json";

export type Locale = "en" | "es" | "fr";
export type Dictionary = typeof en;

export const locales: Locale[] = ["en", "es", "fr"];
export const defaultLocale: Locale = "en";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
  es: () => import("@/dictionaries/es.json").then((m) => m.default),
  fr: () => import("@/dictionaries/fr.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
