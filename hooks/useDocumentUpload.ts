"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logDocumentSubmission } from "@/app/actions/logging";
import { persistOCRToEntityDB } from "@/lib/entitydb-persist";
import { prepareImageBytes } from "@/lib/image-utils";
import { apiFetch } from "@/lib/api-client";
import type { OCRResult, ExtractionResponse, ExtractionErrorResponse } from "@/types";
import { chunkText } from "@/lib/chunking";
import { insertChunk } from "@/lib/entitydb";

export interface UseDocumentUploadResult {
  isSubmitting: boolean;
  ocrProgress: string | null;
  error: string | null;
  handleSubmit: (
    e: React.FormEvent,
    file: File | null,
    sourceLang: string,
    targetLang: string
  ) => Promise<void>;
}

export function useDocumentUpload(): UseDocumentUploadResult {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    e: React.FormEvent,
    file: File | null,
    sourceLang: string,
    targetLang: string
  ): Promise<void> {
    e.preventDefault();

    logDocumentSubmission(sourceLang, targetLang).catch(() => {});
    if (!file) return;

    setIsSubmitting(true);
    setError(null);
    setOcrProgress("Loading OCR engine…");

    try {
      let fullText: string;
      let docId: string;

      const isImage = file.type.startsWith("image/");

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

        const res = await apiFetch("/api/documents/extract", {
          method: "POST",
          body: formData,
        });
        const payload = await res.json();
        if (!res.ok) {
          const errBody = payload as ExtractionErrorResponse;
          throw new Error(errBody.error ?? "Upload failed");
        }

        const extraction = payload as ExtractionResponse;
        fullText = extraction.ocr.fullText;
        docId = extraction.document.id;

        await persistOCRToEntityDB({
          docId: extraction.document.id,
          filename: extraction.document.filename,
          mimeType: extraction.document.mimeType,
          sizeBytes: extraction.document.sizeBytes,
          createdAt: extraction.document.createdAt,
          ocr: extraction.ocr,
          file,
        });
      }

      setOcrProgress("Preparing document for Q&A…");

      void (async () => {
        try {
          const chunks = chunkText(fullText);
          for (const chunk of chunks) {
            await insertChunk(chunk.text, { docId, chunkId: chunk.id });
          }
        } catch (err) {
          console.error("[chunking] Failed to embed chunks:", err);
        }
      })();

      sessionStorage.setItem(
        `translate-${docId}`,
        JSON.stringify({ fullText, filename: file.name, sourceLang, targetLang })
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

  return { isSubmitting, ocrProgress, error, handleSubmit };
}
