"use client";

import { ArrowRightLeftIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const LANGUAGES = [
  { code: "auto", label: "Detect language" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
];

const TARGET_LANGUAGES = LANGUAGES.filter((l) => l.code !== "auto");

export interface LanguageSelectorProps {
  sourceLang: string;
  targetLang: string;
  onSourceChange: (lang: string) => void;
  onTargetChange: (lang: string) => void;
  /** Applies a slightly lighter background for mobile/inset contexts. */
  muted?: boolean;
  className?: string;
}

export function LanguageSelector({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  muted = false,
  className,
}: LanguageSelectorProps) {
  function swapLanguages() {
    if (sourceLang === "auto") return;
    const prev = sourceLang;
    onSourceChange(targetLang);
    onTargetChange(prev);
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border p-4",
        muted ? "bg-muted/20" : "bg-muted/30",
        className
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Translation direction
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={sourceLang} onValueChange={onSourceChange}>
            <SelectTrigger
              className="w-full h-9 text-sm rounded-xl"
              aria-label="Source language"
            >
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Source</SelectLabel>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          onClick={swapLanguages}
          disabled={sourceLang === "auto"}
          aria-label="Swap languages"
          className="flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRightLeftIcon className="size-4" aria-hidden="true" />
        </button>

        <div className="flex-1">
          <Select value={targetLang} onValueChange={onTargetChange}>
            <SelectTrigger
              className="w-full h-9 text-sm rounded-xl"
              aria-label="Target language"
            >
              <SelectValue placeholder="Target" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Target</SelectLabel>
                {TARGET_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
