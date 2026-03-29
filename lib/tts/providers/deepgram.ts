import { resolveAuraModel } from "@/lib/tts/deepgram-voices";
import type { Gender, SpanishAccent, TtsSynthesisResult } from "@/lib/tts/types";
import { TtsError } from "@/lib/tts/types";
import { DEEPGRAM_API_KEY } from "@/lib/env";
import { DEEPGRAM_TIMEOUT_MS } from "@/lib/constants";

interface DeepgramInput {
  text: string;
  targetLang: string;
  gender: Gender;
  spanishAccent?: SpanishAccent;
}

export async function synthesizeWithDeepgram(
  input: DeepgramInput
): Promise<TtsSynthesisResult> {
  const model = resolveAuraModel(
    input.targetLang,
    input.gender,
    input.spanishAccent
  );

  const response = await fetch(
    `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: input.text }),
      signal: AbortSignal.timeout(DEEPGRAM_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Deepgram TTS error:", response.status, errorText);
    throw new TtsError("Deepgram TTS request failed", 502);
  }

  const audioBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "audio/wav";

  return {
    audio: audioBuffer,
    contentType,
    provider: "deepgram",
    model,
  };
}
