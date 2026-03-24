"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isDeepgramLanguage } from "@/lib/tts/deepgram-voices";
import type { Gender, SpanishAccent } from "@/lib/tts/types";

interface TranslateSession {
  fullText: string;
  filename: string;
  sourceLang: string;
  targetLang: string;
}

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

const SPANISH_ACCENTS: Array<{ label: string; value: SpanishAccent }> = [
  { label: "Argentine", value: "argentine" },
  { label: "Colombian", value: "colombian" },
  { label: "Latin American", value: "latin-american" },
  { label: "Mexican", value: "mexican" },
  { label: "Peninsular", value: "peninsular" },
];

export default function TranslatePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");

  const [session, setSession] = useState<TranslateSession | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [isReadAloudOpen, setIsReadAloudOpen] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<Gender>("feminine");
  const [spanishAccent, setSpanishAccent] =
    useState<SpanishAccent>("latin-american");
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

    async function runTranslation() {
      setTranslateLoading(true);
      setTranslateError(null);
      try {
        const res = await fetch("/api/translate", {
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

        setTranslatedText(data.translatedText);
      } catch (err) {
        setTranslateError(
          err instanceof Error ? err.message : "Translation failed"
        );
      } finally {
        setTranslateLoading(false);
      }
    }

    runTranslation();
  }, [session]);

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
        setTtsError("Audio is ready. Tap Play on the player to start playback.");
      }
    };

    void maybePlay();
  }, [ttsAudioUrl]);

  async function handleReadAloudGenerate() {
    if (!translatedText || !session) return;

    setTtsLoading(true);
    setTtsError(null);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translatedText,
          targetLang: session.targetLang,
          gender: showGenderFilter ? voiceGender : "feminine",
          spanishAccent: session.targetLang === "es" ? spanishAccent : undefined,
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

      const _contentType = response.headers.get("content-type") ?? "unknown";
      const _provider = response.headers.get("x-tts-provider") ?? "unknown";
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
      setIsReadAloudOpen(false);
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : "Read Aloud failed");
    } finally {
      setTtsLoading(false);
    }
  }

  async function handlePlayAudio() {
    if (!audioRef.current || !ttsAudioUrl) {
      setTtsError("Generate audio first using Read Aloud.");
      return;
    }

    try {
      await audioRef.current.play();
    } catch {
      setTtsError("Unable to start playback automatically. Try browser media controls.");
    }
  }

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
  const showGenderFilter = session
    ? isDeepgramLanguage(session.targetLang)
    : false;
  const showSpanishAccentFilter = session?.targetLang === "es";
  const hasVoiceFilters = showGenderFilter || showSpanishAccentFilter;

  function handleReadAloudClick() {
    if (hasVoiceFilters) {
      setIsReadAloudOpen(true);
      return;
    }

    void handleReadAloudGenerate();
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
          {/* Original document */}
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

          {/* Translation */}
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

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handlePlayAudio}
                      disabled={!ttsAudioUrl}
                    >
                      <PlayIcon className="size-4" />
                      Play Audio
                    </Button>
                  </div>

                  {ttsLoading && !hasVoiceFilters && (
                    <p className="text-xs text-muted-foreground">
                      Generating audio for {targetLangLabel}. This can take a few
                      seconds.
                    </p>
                  )}

                  <div className="grid gap-2">
                    <audio
                      ref={audioRef}
                      controls
                      src={ttsAudioUrl ?? undefined}
                      className="w-full"
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

      <Dialog open={isReadAloudOpen && hasVoiceFilters} onOpenChange={setIsReadAloudOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Read Aloud voice settings</DialogTitle>
            <DialogDescription>
              Choose voice filters before generating speech audio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {showGenderFilter && (
              <div className="grid gap-2">
                <Label>Gender</Label>
                <RadioGroup
                  value={voiceGender}
                  onValueChange={(value) => setVoiceGender(value as Gender)}
                  className="grid gap-3"
                >
                  <label className="flex items-center gap-2 rounded-md border border-border p-2">
                    <RadioGroupItem value="feminine" id="voice-feminine" />
                    <span>Feminine</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-border p-2">
                    <RadioGroupItem value="masculine" id="voice-masculine" />
                    <span>Masculine</span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {showSpanishAccentFilter && (
              <div className="grid gap-2">
                <Label>Accent</Label>
                <RadioGroup
                  value={spanishAccent}
                  onValueChange={(value) =>
                    setSpanishAccent(value as SpanishAccent)
                  }
                  className="grid gap-2"
                >
                  {SPANISH_ACCENTS.map((accent) => (
                    <label
                      key={accent.value}
                      className="flex items-center gap-2 rounded-md border border-border p-2"
                    >
                      <RadioGroupItem value={accent.value} id={accent.value} />
                      <span>{accent.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReadAloudOpen(false)}
              disabled={ttsLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReadAloudGenerate}
              disabled={ttsLoading || !translatedText}
              className="gap-2"
            >
              {ttsLoading && <Spinner className="size-4" aria-hidden="true" />}
              {ttsLoading ? "Generating..." : "Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
