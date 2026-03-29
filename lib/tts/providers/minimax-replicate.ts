import Replicate from "replicate";
import type { Gender, TtsSynthesisResult } from "@/lib/tts/types";
import { TtsError } from "@/lib/tts/types";
import {
  REPLICATE_API_TOKEN,
  MINIMAX_REPLICATE_MODEL,
  MINIMAX_FEMININE_VOICE_ID,
  MINIMAX_MASCULINE_VOICE_ID,
  MINIMAX_AUDIO_FORMAT,
} from "@/lib/env";
import {
  REPLICATE_META_TIMEOUT_MS,
  REPLICATE_RUN_TIMEOUT_MS,
  AUDIO_DOWNLOAD_TIMEOUT_MS,
} from "@/lib/constants";

type ReplicateModelRef = `${string}/${string}` | `${string}/${string}:${string}`;

let resolvedModelRef: ReplicateModelRef | null = null;

function resolveVoiceId(gender: Gender): string {
  return gender === "masculine"
    ? MINIMAX_MASCULINE_VOICE_ID
    : MINIMAX_FEMININE_VOICE_ID;
}

function resolveLanguageBoost(targetLang: string): string | undefined {
  if (targetLang === "sv") {
    return "Swedish";
  }
  if (targetLang === "vi") {
    return "Vietnamese";
  }
  return undefined;
}

function getOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.length > 0) {
    return output;
  }

  if (Array.isArray(output)) {
    const firstUrl = output.find((item) => typeof item === "string");
    if (typeof firstUrl === "string") {
      return firstUrl;
    }
  }

  if (
    typeof output === "object" &&
    output !== null &&
    "url" in output &&
    typeof (output as { url?: unknown }).url === "function"
  ) {
    const maybeUrl = String((output as { url: () => unknown }).url());
    return maybeUrl.length > 0 ? maybeUrl : null;
  }

  return null;
}

async function resolveModelRef(): Promise<ReplicateModelRef> {
  if (resolvedModelRef) {
    return resolvedModelRef;
  }

  if (MINIMAX_REPLICATE_MODEL.includes(":")) {
    resolvedModelRef = MINIMAX_REPLICATE_MODEL as ReplicateModelRef;
    return resolvedModelRef;
  }

  const modelResponse = await fetch(
    `https://api.replicate.com/v1/models/${MINIMAX_REPLICATE_MODEL}`,
    {
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
      },
      signal: AbortSignal.timeout(REPLICATE_META_TIMEOUT_MS),
    }
  );

  if (!modelResponse.ok) {
    throw new TtsError("MiniMax model lookup failed", 502);
  }

  const modelData = (await modelResponse.json()) as {
    latest_version?: { id?: string };
  };
  const version = modelData.latest_version?.id;
  if (!version) {
    throw new TtsError("MiniMax model version was not found", 502);
  }

  resolvedModelRef = `${MINIMAX_REPLICATE_MODEL}:${version}` as ReplicateModelRef;
  return resolvedModelRef;
}

export async function synthesizeWithMinimaxReplicate(input: {
  text: string;
  targetLang: string;
  gender: Gender;
}): Promise<TtsSynthesisResult> {
  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
  const modelRef = await resolveModelRef();

  const languageBoost = resolveLanguageBoost(input.targetLang);
  let output: unknown;
  try {
    output = await replicate.run(modelRef, {
      input: {
        text: input.text,
        voice_id: resolveVoiceId(input.gender),
        audio_format: MINIMAX_AUDIO_FORMAT,
        ...(languageBoost ? { language_boost: languageBoost } : {}),
      },
      signal: AbortSignal.timeout(REPLICATE_RUN_TIMEOUT_MS),
    });
  } catch (error) {
    const maybeError = error as { message?: string; status?: number };
    console.error("Replicate MiniMax error", {
      status: maybeError.status,
      message: maybeError.message ?? "Unknown Replicate error",
    });
    throw new TtsError("MiniMax request failed", 502);
  }

  const audioUrl = getOutputUrl(output);
  if (!audioUrl) {
    throw new TtsError("MiniMax returned an invalid audio response", 502);
  }

  const audioResponse = await fetch(audioUrl, {
    signal: AbortSignal.timeout(AUDIO_DOWNLOAD_TIMEOUT_MS),
  });
  if (!audioResponse.ok) {
    throw new TtsError("MiniMax audio download failed", 502);
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  return {
    audio: audioBuffer,
    contentType: audioResponse.headers.get("content-type") ?? "audio/mpeg",
    provider: "minimax",
    model: modelRef,
  };
}
