/**
 * Centralised environment variable access with fail-fast validation.
 *
 * Import this module from any server-side code that needs env vars.
 * Missing **required** vars throw immediately at import time so a
 * misconfigured deploy crashes on startup — not on the first user request.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        "See .env.local.example for reference.",
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// ---------------------------------------------------------------------------
// Third-party API keys (required — app cannot function without them)
// ---------------------------------------------------------------------------

export const DEEPL_API_KEY = required("DEEPL_API_KEY");
export const DEEPGRAM_API_KEY = required("DEEPGRAM_API_KEY");
export const REPLICATE_API_TOKEN = required("REPLICATE_API_TOKEN");
export const OPEN_ROUTER_API_TOKEN = required("OPEN_ROUTER_API_TOKEN");

// ---------------------------------------------------------------------------
// Upstash Redis (required in production, skipped in local dev)
// ---------------------------------------------------------------------------

export const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
export const UPSTASH_REDIS_REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

// ---------------------------------------------------------------------------
// TTS provider tuning (optional — sensible defaults provided)
// ---------------------------------------------------------------------------

export const XTTS_REPLICATE_MODEL = optional(
  "XTTS_REPLICATE_MODEL",
  "lucataco/xtts-v2",
);
export const XTTS_SPEAKER_WAV_URL = optional(
  "XTTS_SPEAKER_WAV_URL",
  "https://raw.githubusercontent.com/lucataco/cog-xtts-v2/main/female.wav",
);
export const MINIMAX_REPLICATE_MODEL = optional(
  "MINIMAX_REPLICATE_MODEL",
  "minimax/speech-02-turbo",
);
export const MINIMAX_FEMININE_VOICE_ID = optional(
  "MINIMAX_FEMININE_VOICE_ID",
  "Wise_Woman",
);
export const MINIMAX_MASCULINE_VOICE_ID = optional(
  "MINIMAX_MASCULINE_VOICE_ID",
  "Deep_Voice_Man",
);
export const MINIMAX_AUDIO_FORMAT = optional("MINIMAX_AUDIO_FORMAT", "mp3");
