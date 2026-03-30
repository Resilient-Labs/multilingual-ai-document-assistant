"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logDocumentSubmission } from "@/app/actions/logging";
import { persistOCRToEntityDB } from "@/lib/entitydb-persist";
import { chunkText } from "@/lib/chunking";
import { insertChunk } from "@/lib/entitydb";
import { prepareImageBytes } from "@/lib/image-utils";
import type { OCRResult } from "@/types";

export interface UseDocumentUploadOptions {
  sourceLang: string;
  targetLang: string;
}

export interface UseDocumentUploadReturn {
  isSubmitting: boolean;
  ocrProgress: string | null;
  error: string | null;
  submit: (file: File) => Promise<void>;
}

export function useDocumentUpload({
  sourceLang,
  targetLang,
}: UseDocumentUploadOptions): UseDocumentUploadReturn {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(file: File) {
    logDocumentSubmission(sourceLang, targetLang).catch(() => {});

    setIsSubmitting(true);
    setError(null);
    setOcrProgress("Loading OCR engine…");

    const isImage = file.type.startsWith("image/");

    try {
      let fullText: string;
      let docId: string;

      if (isImage) {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setOcrProgress(`Recognizing… ${Math.round(m.progress * 100)}%`);
            } else {
              setOcrProgress(m.status);
            }
          },
        });

        const bytes = await prepareImageBytes(file, setOcrProgress);
        const { data } = await worker.recognize(
          bytes as unknown as Parameters<typeof worker.recognize>[0],
          {},
          { text: true } as Parameters<typeof worker.recognize>[2]
        );
        await worker.terminate();

        fullText = data.text.trim();
        docId = `doc_${crypto.randomUUID()}`;

        const createdAt = Date.now();
        const ocrResult: OCRResult = {
          documentId: docId,
          fullText,
          blocks: [
            {
              id: "b1",
              documentId: docId,
              text: fullText,
              confidence: 1.0,
            },
          ],
        };

        await persistOCRToEntityDB({
          docId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          createdAt,
          ocr: ocrResult,
          file,
        });
      } else {
        setOcrProgress("Uploading…");
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Upload failed");

        fullText = payload.ocr.fullText;
        docId = payload.docId;

        await persistOCRToEntityDB({
          docId: payload.docId,
          filename: payload.filename ?? file.name,
          mimeType: payload.mimeType ?? file.type,
          sizeBytes: payload.sizeBytes ?? file.size,
          createdAt: payload.createdAt ?? Date.now(),
          ocr: payload.ocr,
          file,
        });
      }

      setOcrProgress("Preparing document for Q&A…");

      Promise.resolve().then(async () => {
        try {
          const chunks = chunkText(fullText);
          for (const chunk of chunks) {
            await insertChunk(chunk.text, { docId, chunkId: chunk.id });
          }
        } catch (err) {
          console.error("[chunking] Failed to embed chunks:", err);
        }
      });

      sessionStorage.setItem(
        `translate-${docId}`,
        JSON.stringify({
          fullText,
          filename: file.name,
          sourceLang,
          targetLang,
        })
      );
      sessionStorage.setItem("current-doc-id", docId);
      router.push(`/translate/${docId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setOcrProgress(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, ocrProgress, error, submit };
}
