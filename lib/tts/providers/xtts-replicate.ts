import Replicate from "replicate";
import { mapToXttsLanguage } from "@/lib/tts/xtts-language-map";
import type { TtsSynthesisResult } from "@/lib/tts/types";
import { TtsError } from "@/lib/tts/types";
import {
  REPLICATE_API_TOKEN,
  XTTS_REPLICATE_MODEL,
  XTTS_SPEAKER_WAV_URL,
} from "@/lib/env";
type ReplicateModelRef = `${string}/${string}` | `${string}/${string}:${string}`;
let resolvedModelRef: ReplicateModelRef | null = null;

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

  if (XTTS_REPLICATE_MODEL.includes(":")) {
    resolvedModelRef = XTTS_REPLICATE_MODEL as ReplicateModelRef;
    return resolvedModelRef;
  }

  const modelResponse = await fetch(
    `https://api.replicate.com/v1/models/${XTTS_REPLICATE_MODEL}`,
    {
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
      },
    }
  );

  if (!modelResponse.ok) {
    throw new TtsError("XTTS fallback model lookup failed", 502);
  }

  const modelData = (await modelResponse.json()) as {
    latest_version?: { id?: string };
  };
  const version = modelData.latest_version?.id;
  if (!version) {
    throw new TtsError("XTTS fallback model version was not found", 502);
  }

  resolvedModelRef = `${XTTS_REPLICATE_MODEL}:${version}` as ReplicateModelRef;
  return resolvedModelRef;
}

export async function synthesizeWithXttsReplicate(input: {
  text: string;
  targetLang: string;
}): Promise<TtsSynthesisResult> {
  const language = mapToXttsLanguage(input.targetLang);
  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
  const modelRef = await resolveModelRef();

  let output: unknown;
  try {
    output = await replicate.run(modelRef, {
      input: {
        text: input.text,
        speaker: XTTS_SPEAKER_WAV_URL,
        language,
      },
    });
  } catch (error) {
    const maybeError = error as { message?: string; status?: number };
    console.error("Replicate XTTS error", {
      status: maybeError.status,
      message: maybeError.message ?? "Unknown Replicate error",
    });
    throw new TtsError("XTTS fallback request failed", 502);
  }

  const audioUrl = getOutputUrl(output);
  if (!audioUrl) {
    throw new TtsError("XTTS fallback returned an invalid audio response", 502);
  }

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new TtsError("XTTS fallback audio download failed", 502);
  }

  const audioBuffer = await audioResponse.arrayBuffer();

  return {
    audio: audioBuffer,
    contentType: audioResponse.headers.get("content-type") ?? "audio/wav",
    provider: "xtts",
    model: modelRef,
  };
}
