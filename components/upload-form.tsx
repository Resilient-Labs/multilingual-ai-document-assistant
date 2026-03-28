"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  CameraIcon,
  FileTextIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { LanguageSelector } from "@/components/shared/LanguageSelector";

interface UploadFormProps {
  mobile?: boolean;
}

export function UploadForm({ mobile = false }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("es");

  const { isSubmitting, ocrProgress, error, handleSubmit } = useDocumentUpload();

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

  function removeFile(e: React.MouseEvent) {
    e.stopPropagation();
    setFile(null);
  }

  const submitLabel =
    isSubmitting && ocrProgress ? ocrProgress : "Translate document";

  const ErrorMessage = error && (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/40 bg-destructive/5 text-destructive p-4 text-sm"
    >
      {error}
    </div>
  );

  /* ── Mobile layout ─────────────────────────────────────────────── */
  if (mobile) {
    return (
      <form
        onSubmit={(e) => handleSubmit(e, file, sourceLang, targetLang)}
        className="flex flex-col gap-3 h-full"
      >
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
                <FileTextIcon className="size-4 shrink-0 text-indigo-500" aria-hidden="true" />
                <span className="max-w-[180px] truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={removeFile}
                  aria-label="Remove file"
                  className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
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
                <CameraIcon className="size-4" aria-hidden="true" />
                Take photo
              </Button>
            </>
          )}
        </div>

        <LanguageSelector
          sourceLang={sourceLang}
          targetLang={targetLang}
          onSourceChange={setSourceLang}
          onTargetChange={setTargetLang}
          muted
        />

        {ErrorMessage}

        <Button
          type="submit"
          disabled={!file || isSubmitting}
          className="w-full rounded-xl h-10"
        >
          {isSubmitting ? <Spinner className="size-4" /> : submitLabel}
        </Button>
      </form>
    );
  }

  /* ── Desktop layout ────────────────────────────────────────────── */
  return (
    <form
      onSubmit={(e) => handleSubmit(e, file, sourceLang, targetLang)}
      className="flex flex-col gap-4"
    >
      <LanguageSelector
        sourceLang={sourceLang}
        targetLang={targetLang}
        onSourceChange={setSourceLang}
        onTargetChange={setTargetLang}
      />

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
              <FileTextIcon className="size-5 shrink-0 text-indigo-500" aria-hidden="true" />
              <span className="max-w-[220px] truncate text-base font-medium">{file.name}</span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={removeFile}
                aria-label="Remove file"
                className="ml-1 rounded p-1 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
            <span className="text-sm text-indigo-600">Click or drag to replace</span>
          </div>
        ) : (
          <>
            <UploadCloudIcon className="size-16 text-indigo-400" aria-hidden="true" />
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

      {ErrorMessage}

      <Button
        type="submit"
        disabled={!file || isSubmitting}
        size="lg"
        className="w-full text-base h-12"
      >
        {isSubmitting ? <Spinner className="size-5" /> : submitLabel}
      </Button>
    </form>
  );
}
