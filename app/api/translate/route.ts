import { NextResponse } from "next/server";
import { MAX_TRANSLATE_CHARS, DEEPL_TIMEOUT_MS } from "@/lib/constants";
import { DEEPL_API_KEY } from "@/lib/env";
import { DEEPL_LANG_MAP } from "@/lib/languages";

/**
 * POST /api/translate
 * Source language is always EN per product requirements.
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

    if (text.length > MAX_TRANSLATE_CHARS) {
      return NextResponse.json(
        {
          error: `Text too long. Maximum is ${MAX_TRANSLATE_CHARS.toLocaleString()} characters.`,
          code: "INPUT_TOO_LONG",
        },
        { status: 413 }
      );
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
      signal: AbortSignal.timeout(DEEPL_TIMEOUT_MS),
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Translation request timed out" },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
