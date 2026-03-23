import { NextResponse } from "next/server";

/**
 * Maps the app's language codes to DeepL v2 target language codes.
 * Source language is always EN per product requirements.
 * Full list: https://developers.deepl.com/docs/resources/supported-languages
 */
const DEEPL_LANG_MAP: Record<string, string> = {
  en: "EN-US",
  es: "ES",
  fr: "FR",
  de: "DE",
  zh: "ZH-HANS",
  "zh-TW": "ZH-HANT",
  ja: "JA",
  ko: "KO",
  pt: "PT-PT",
  it: "IT",
  ru: "RU",
  ar: "AR",
  hi: "HI",
  nl: "NL",
  pl: "PL",
  sv: "SV",
  tr: "TR",
  vi: "VI",
};

// DEEPL_API_KEY — set in .env.local
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

/**
 * POST /api/translate
 * Body: { text: string, targetLang: string }
 * Returns: { translatedText: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, targetLang } = body as { text?: string; targetLang?: string };

    if (!text || typeof text !== "string" || text.trim() === "") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    if (!targetLang || typeof targetLang !== "string") {
      return NextResponse.json(
        { error: "No target language provided" },
        { status: 400 }
      );
    }

    const deeplTarget = DEEPL_LANG_MAP[targetLang];
    if (!deeplTarget) {
      return NextResponse.json(
        { error: `Unsupported target language: ${targetLang}` },
        { status: 400 }
      );
    }

    if (!DEEPL_API_KEY) {
      return NextResponse.json(
        { error: "Translation service is not configured" },
        { status: 503 }
      );
    }

    const deeplRes = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        source_lang: "EN",
        target_lang: deeplTarget,
      }),
    });

    if (!deeplRes.ok) {
      const errorText = await deeplRes.text();
      console.error("DeepL API error:", deeplRes.status, errorText);
      return NextResponse.json(
        { error: "Translation service returned an error" },
        { status: 502 }
      );
    }

    const deeplData = await deeplRes.json();
    const translatedText: string = deeplData.translations?.[0]?.text ?? "";

    return NextResponse.json({ translatedText });
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
