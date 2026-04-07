"use client";

import { type RefObject } from "react";

interface TtsPlaybackVisualProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioUrl: string;
  text: string;
}

export function TtsPlaybackVisual({
  audioRef,
  audioUrl,
  text,
}: TtsPlaybackVisualProps) {
  return (
    <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
      <p className="mb-2 font-medium text-foreground">Audio ready</p>
      <p className="line-clamp-2">{text}</p>
      <button
        type="button"
        className="mt-2 text-xs underline"
        onClick={() => audioRef.current?.play()}
        data-audio-url={audioUrl}
      >
        Play
      </button>
    </div>
  );
}
