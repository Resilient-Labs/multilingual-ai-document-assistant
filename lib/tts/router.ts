import { isDeepgramLanguage } from "@/lib/tts/deepgram-voices";
import { synthesizeWithDeepgram } from "@/lib/tts/providers/deepgram";
import { synthesizeWithMinimaxReplicate } from "@/lib/tts/providers/minimax-replicate";
import { synthesizeWithXttsReplicate } from "@/lib/tts/providers/xtts-replicate";
import type { TtsProvider, TtsRequestPayload, TtsSynthesisResult } from "@/lib/tts/types";
import { TtsError } from "@/lib/tts/types";

const MINIMAX_PREFERRED_LANGUAGES = new Set(["sv", "vi"]);

export function getTtsProvider(targetLang: string): TtsProvider {
  if (MINIMAX_PREFERRED_LANGUAGES.has(targetLang)) {
    return "minimax";
  }

  return isDeepgramLanguage(targetLang) ? "deepgram" : "xtts";
}

async function runProvider(
  provider: TtsProvider,
  payload: TtsRequestPayload
): Promise<TtsSynthesisResult> {
  if (provider === "deepgram") {
    return synthesizeWithDeepgram(payload);
  }

  if (provider === "xtts") {
    return synthesizeWithXttsReplicate(payload);
  }

  return synthesizeWithMinimaxReplicate(payload);
}

function getFallbackChain(primaryProvider: TtsProvider): TtsProvider[] {
  if (primaryProvider === "deepgram") {
    return ["deepgram", "xtts", "minimax"];
  }

  if (primaryProvider === "xtts") {
    return ["xtts", "minimax"];
  }

  return ["minimax", "xtts"];
}

export async function synthesizeSpeech(
  payload: TtsRequestPayload
): Promise<TtsSynthesisResult> {
  const primaryProvider = getTtsProvider(payload.targetLang);
  const providers = getFallbackChain(primaryProvider);
  let lastError: unknown;

  for (const provider of providers) {
    try {
      return await runProvider(provider, payload);
    } catch (error) {
      lastError = error;
      console.warn(`TTS provider failed: ${provider}`, error);
    }
  }

  if (lastError instanceof TtsError) {
    throw lastError;
  }

  throw new TtsError("All TTS providers failed", 502);
}
