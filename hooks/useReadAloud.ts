"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Gender, SpanishAccent } from "@/lib/tts/types";

export interface ReadAloudOptions {
  gender: Gender;
  spanishAccent?: SpanishAccent;
}

export interface UseReadAloudResult {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  ttsAudioUrl: string | null;
  ttsLoading: boolean;
  ttsError: string | null;
  generateAudio: (
    text: string,
    targetLang: string,
    options: ReadAloudOptions
  ) => Promise<void>;
}

export function useReadAloud(): UseReadAloudResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (ttsAudioUrl) {
        URL.revokeObjectURL(ttsAudioUrl);
      }
    };
  }, [ttsAudioUrl]);

  useEffect(() => {
    if (!ttsAudioUrl || !audioRef.current) return;

    const maybePlay = async () => {
      try {
        await audioRef.current?.play();
      } catch {
        setTtsError(
          "Audio is ready. Tap Play in AI Read Aloud to start playback."
        );
      }
    };

    void maybePlay();
  }, [ttsAudioUrl]);

  async function generateAudio(
    text: string,
    targetLang: string,
    options: ReadAloudOptions
  ) {
    setTtsLoading(true);
    setTtsError(null);
    try {
      const response = await apiFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          targetLang,
          gender: options.gender,
          spanishAccent: targetLang === "es" ? options.spanishAccent : undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Read Aloud failed";
        try {
          const data = await response.json();
          errorMessage = data.error ?? errorMessage;
        } catch {
          // Keep fallback message when response body is not JSON.
        }
        throw new Error(errorMessage);
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        throw new Error("Generated audio was empty. Please try again.");
      }

      const nextAudioUrl = URL.createObjectURL(audioBlob);
      setTtsAudioUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextAudioUrl;
      });
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : "Read Aloud failed");
    } finally {
      setTtsLoading(false);
    }
  }

  return { audioRef, ttsAudioUrl, ttsLoading, ttsError, generateAudio };
}
