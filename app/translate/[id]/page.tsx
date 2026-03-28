"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Volume2Icon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TtsPlaybackVisual } from "@/components/features/tts/TtsPlaybackVisual";
import { VoiceFilterDialog } from "@/components/features/tts/VoiceFilterDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useReadAloud } from "@/hooks/useReadAloud";
import { isDeepgramLanguage } from "@/lib/tts/deepgram-voices";
import type { Gender, SpanishAccent } from "@/lib/tts/types";

const LANGUAGE_LABELS: Record<string, string> = {
  auto: "Detected",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  tr: "Turkish",
  vi: "Vietnamese",
};

export default function TranslatePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");

  const { session, sessionMissing, translatedText, translateLoading, translateError } =
    useTranslation(id);

  const { audioRef, ttsAudioUrl, ttsLoading, ttsError, generateAudio } =
    useReadAloud();

  const [isReadAloudOpen, setIsReadAloudOpen] = useState(false);
  const [voiceGender, setVoiceGender] = useState<Gender>("feminine");
  const [spanishAccent, setSpanishAccent] = useState<SpanishAccent>("latin-american");

  if (sessionMissing) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>Session expired</AlertTitle>
            <AlertDescription>
              No document data found. Please upload your document again.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="w-fit gap-2"
          >
            <ArrowLeftIcon className="size-4" />
            Back to upload
          </Button>
        </div>
      </div>
    );
  }

  const sourceLangLabel = session
    ? (LANGUAGE_LABELS[session.sourceLang] ?? session.sourceLang)
    : "";
  const targetLangLabel = session
    ? (LANGUAGE_LABELS[session.targetLang] ?? session.targetLang)
    : "";
  const showGenderFilter = session ? isDeepgramLanguage(session.targetLang) : false;
  const showSpanishAccentFilter = session?.targetLang === "es";
  const hasVoiceFilters = showGenderFilter || showSpanishAccentFilter;

  function handleReadAloudClick() {
    if (!translatedText || !session) return;
    if (hasVoiceFilters) {
      setIsReadAloudOpen(true);
      return;
    }
    void generateAudio(translatedText, session.targetLang, { gender: voiceGender });
  }

  function handleVoiceFilterConfirm() {
    if (!translatedText || !session) return;
    setIsReadAloudOpen(false);
    void generateAudio(translatedText, session.targetLang, {
      gender: showGenderFilter ? voiceGender : "feminine",
      spanishAccent,
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="-ml-2 gap-2 text-muted-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>

          {session && (
            <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
              <p className="max-w-[200px] truncate text-sm font-medium md:max-w-xs">
                {session.filename}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {sourceLangLabel}
                <ArrowRightIcon className="size-3" />
                {targetLangLabel}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <Card className="flex w-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Original Document</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 overflow-y-auto">
              {!session ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-6" aria-label="Loading document" />
                </div>
              ) : (
                <Textarea
                  readOnly
                  value={session.fullText}
                  className="min-h-[120px] max-h-64 resize-none overflow-y-auto"
                  aria-label="Original document text"
                />
              )}
            </CardContent>
          </Card>

          <Card className="flex w-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>
                Translation
                {session && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({targetLangLabel})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 overflow-y-auto">
              {translateLoading && (
                <div className="flex items-center justify-center py-8">
                  <Spinner
                    className="size-6"
                    aria-label="Translating document"
                  />
                </div>
              )}

              {!translateLoading && translateError && (
                <Alert variant="destructive">
                  <AlertTitle>Translation failed</AlertTitle>
                  <AlertDescription>{translateError}</AlertDescription>
                </Alert>
              )}

              {!translateLoading && !translateError && translatedText !== null && (
                <>
                  <Textarea
                    readOnly
                    value={translatedText}
                    className="min-h-[120px] max-h-64 resize-none overflow-y-auto"
                    aria-label="Translated text"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleReadAloudClick}
                      disabled={ttsLoading}
                    >
                      {ttsLoading && !hasVoiceFilters ? (
                        <Spinner className="size-4" aria-hidden="true" />
                      ) : (
                        <Volume2Icon className="size-4" />
                      )}
                      {ttsLoading && !hasVoiceFilters
                        ? "Generating audio..."
                        : "Read Aloud"}
                    </Button>
                  </div>

                  {ttsLoading && !hasVoiceFilters && (
                    <p className="text-xs text-muted-foreground">
                      Generating audio for {targetLangLabel}. This can take a few
                      seconds.
                    </p>
                  )}

                  <div className="grid gap-2">
                    {ttsAudioUrl && translatedText && (
                      <TtsPlaybackVisual
                        audioRef={audioRef}
                        audioUrl={ttsAudioUrl}
                        text={translatedText}
                      />
                    )}
                    <audio
                      ref={audioRef}
                      src={ttsAudioUrl ?? undefined}
                      className="sr-only"
                      preload="metadata"
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      Your browser does not support audio playback.
                    </audio>
                    {!ttsAudioUrl && (
                      <p className="text-xs text-muted-foreground">
                        No audio generated yet. Click Read Aloud.
                      </p>
                    )}
                  </div>
                </>
              )}

              {!translateLoading && !translateError && ttsError && (
                <Alert variant="destructive">
                  <AlertTitle>Read Aloud failed</AlertTitle>
                  <AlertDescription>{ttsError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <VoiceFilterDialog
        open={isReadAloudOpen && hasVoiceFilters}
        onOpenChange={setIsReadAloudOpen}
        showGenderFilter={showGenderFilter}
        showSpanishAccentFilter={showSpanishAccentFilter}
        voiceGender={voiceGender}
        onVoiceGenderChange={setVoiceGender}
        spanishAccent={spanishAccent}
        onSpanishAccentChange={setSpanishAccent}
        onConfirm={handleVoiceFilterConfirm}
        loading={ttsLoading}
        disabled={ttsLoading || !translatedText}
      />
    </div>
  );
}
