"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface TranslateSession {
  fullText: string;
  filename: string;
  sourceLang: string;
  targetLang: string;
}

export interface UseTranslationResult {
  session: TranslateSession | null;
  sessionMissing: boolean;
  translatedText: string | null;
  translateLoading: boolean;
  translateError: string | null;
}

export function useTranslation(id: string): UseTranslationResult {
  const [session, setSession] = useState<TranslateSession | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const raw = sessionStorage.getItem(`translate-${id}`);
    if (!raw) {
      setSessionMissing(true);
      return;
    }
    try {
      const parsed: TranslateSession = JSON.parse(raw);
      setSession(parsed);
    } catch {
      setSessionMissing(true);
    }
  }, [id]);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    async function runTranslation() {
      setTranslateLoading(true);
      setTranslateError(null);
      try {
        const res = await apiFetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: session!.fullText,
            targetLang: session!.targetLang,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Translation failed");
        }

        if (!cancelled) {
          setTranslatedText(data.translatedText);
        }
      } catch (err) {
        if (!cancelled) {
          setTranslateError(
            err instanceof Error ? err.message : "Translation failed"
          );
        }
      } finally {
        if (!cancelled) {
          setTranslateLoading(false);
        }
      }
    }

    runTranslation();

    return () => {
      cancelled = true;
    };
  }, [session]);

  return {
    session,
    sessionMissing,
    translatedText,
    translateLoading,
    translateError,
  };
}
