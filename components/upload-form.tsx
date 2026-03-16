"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  ArrowRightLeftIcon,
  CameraIcon,
  FileTextIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Spinner } from "@/components/ui/spinner";

const LANGUAGES = [
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

interface UploadFormProps {
  mobile?: boolean;
}

export function UploadForm({ mobile = false }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("es");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * TODO (next team): implement document upload + translation flow
   *
   * Steps needed:
   *  1. Upload `file` to the backend — see POST /api/documents/upload
   *     - Send as multipart/form-data
   *     - Receive back a `documentId`
   *  2. Kick off translation job with `sourceLang` and `targetLang`
   *     - POST /api/translate  { documentId, sourceLang, targetLang }
   *  3. Redirect to the translation results page, e.g.:
   *     - router.push(`/translate/${documentId}`)
   *     - Or whichever route the translate tab maps to
   *  4. Handle loading / error states (isSubmitting is wired up, just set it)
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setIsSubmitting(true);
    try {
      // TODO: replace this placeholder with the real upload + redirect logic above
      console.log("Upload payload →", { file, sourceLang, targetLang });
      alert(`[Placeholder] Would upload "${file.name}" and translate ${sourceLang} → ${targetLang}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"],
    },
  });

  function swapLanguages() {
    if (sourceLang === "auto") return;
    const prev = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(prev);
  }

  function removeFile(e: React.MouseEvent) {
    e.stopPropagation();
    setFile(null);
  }

  const TranslationDirection = (
    <div className={cn("rounded-2xl border border-border p-4", mobile ? "bg-muted/20" : "bg-muted/30")}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Translation direction
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-full h-9 text-sm rounded-xl">
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
          className="flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowRightLeftIcon className="size-4" />
        </button>

        <div className="flex-1">
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-full h-9 text-sm rounded-xl">
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

  /* ── Mobile layout ─────────────────────────────────────────────── */
  if (mobile) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 h-full">
        {/* Large dropzone */}
        <div
          {...getRootProps()}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed cursor-pointer transition-colors min-h-[280px]",
            isDragActive
              ? "border-indigo-400 bg-indigo-200"
              : "border-indigo-300 bg-indigo-100"
          )}
        >
          <input {...getInputProps()} />

          {file ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-sm">
                <FileTextIcon className="size-4 shrink-0 text-indigo-500" />
                <span className="max-w-[180px] truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={removeFile}
                  aria-label="Remove file"
                  className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
              <span className="text-xs text-indigo-600">Tap to replace</span>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1 text-center px-8">
                <p className="text-base font-semibold text-foreground">
                  Take a photo or upload a file
                </p>
                <p className="text-sm text-muted-foreground">10MB max</p>
              </div>
              <Button
                size="default"
                type="button"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6"
              >
                <CameraIcon className="size-4" />
                Take photo
              </Button>
            </>
          )}
        </div>

        {/* Translation direction — below dropzone on mobile */}
        {TranslationDirection}

        <Button type="submit" disabled={!file || isSubmitting} className="w-full rounded-xl h-10">
          {isSubmitting ? <Spinner className="size-4" /> : "Translate document"}
        </Button>
      </form>
    );
  }

  /* ── Desktop layout ────────────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Translation direction — above dropzone on desktop */}
      {TranslationDirection}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-10 py-16 text-center cursor-pointer transition-colors min-h-[280px]",
          isDragActive
            ? "border-indigo-400 bg-indigo-200"
            : "border-indigo-300 bg-indigo-100 hover:border-indigo-400 hover:bg-indigo-200"
        )}
      >
        <input {...getInputProps()} />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
              <FileTextIcon className="size-5 shrink-0 text-indigo-500" />
              <span className="max-w-[220px] truncate text-base font-medium">{file.name}</span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={removeFile}
                aria-label="Remove file"
                className="ml-1 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <span className="text-sm text-indigo-600">Click or drag to replace</span>
          </div>
        ) : (
          <>
            <UploadCloudIcon className="size-16 text-indigo-400" />
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">
                {isDragActive ? "Drop your file here" : "Drag & drop or choose a file"}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, DOC, DOCX, TXT, or image — 10 MB max
              </p>
            </div>
            <Button size="lg" variant="outline" type="button" className="px-8 text-base">
              Browse files
            </Button>
          </>
        )}
      </div>

      <Button type="submit" disabled={!file || isSubmitting} size="lg" className="w-full text-base h-12">
        {isSubmitting ? <Spinner className="size-5" /> : "Translate document"}
      </Button>
    </form>
  );
}
