"use client";

import { useEffect, useState } from "react";
import { useDocumentSession } from "@/hooks/useDocumentSession";
import type { CanonicalDocument } from "@/types/CanonicalDocument";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type JobStatus =
  | "upload/received"
  | "processing"
  | "new_doc_processed"
  | "post_persist"
  | "file_selected"
  | "error";

export const JOB_STATUS_PROGRESS: Record<JobStatus, number> = {
  "upload/received": 15,
  processing: 55,
  new_doc_processed: 80,
  post_persist: 95,
  file_selected: 100,
  error: 0,
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  "upload/received": "Upload received…",
  processing: "Processing document…",
  new_doc_processed: "Finalising extraction…",
  post_persist: "Saving results…",
  file_selected: "Ready",
  error: "An error occurred",
};

function buildInitialFieldValues(
  candidates: CanonicalDocument["fieldCandidates"]
): Record<string, string> {
  return Object.fromEntries(candidates.map((fc) => [fc.id, fc.value]));
}

export interface ExtractedDataPanelProps {
  sessionId?: string;
  jobStatus?: JobStatus;
}

export function ExtractedDataPanel({
  sessionId,
  jobStatus = "file_selected",
}: ExtractedDataPanelProps): React.ReactElement {
  const { data, loading, error } = useDocumentSession(sessionId);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isReady = jobStatus === "file_selected";
  const isJobError = jobStatus === "error";

  useEffect(() => {
    if (data) {
      setFieldValues(buildInitialFieldValues(data.fieldCandidates));
      setIsSubmitted(false);
      setValidationError(null);
    }
  }, [data]);

  function handleTabChange(): void {
    setIsSubmitted(false);
    setValidationError(null);
  }

  function handleFieldChange(candidateId: string, value: string): void {
    setFieldValues((prev) => ({ ...prev, [candidateId]: value }));
    setValidationError(null);
    setIsSubmitted(false);
  }

  function handleSubmit(): void {
    if (!data) return;

    const allFilled = data.fieldCandidates.every((fc) => {
      const value = fieldValues[fc.id];
      return !!value && value.trim() !== "";
    });

    if (!allFilled) {
      setValidationError("All fields must be filled before submitting.");
      return;
    }

    setValidationError(null);
    setIsSubmitted(true);
  }

  return (
    <Card className="flex w-full flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>Document Details</CardTitle>
      </CardHeader>
      <CardContent
        aria-busy={loading}
        className="flex flex-col gap-4 overflow-y-auto"
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" aria-label="Loading document" />
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive">
            <AlertTitle>Failed to load document</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && data === null && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No document loaded.
          </p>
        )}

        {!loading && !error && data !== null && !isReady && (
          <div className="flex flex-col gap-3 py-4">
            {isJobError ? (
              <Alert variant="destructive">
                <AlertTitle>Processing failed</AlertTitle>
                <AlertDescription>
                  {JOB_STATUS_LABEL[jobStatus]}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {JOB_STATUS_LABEL[jobStatus]}
                </p>
                <Progress value={JOB_STATUS_PROGRESS[jobStatus]} />
              </>
            )}
          </div>
        )}

        {!loading && !error && data !== null && isReady && (
          <Tabs defaultValue="fields" onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="fields">Extracted Fields</TabsTrigger>
              <TabsTrigger value="form">Form to Complete</TabsTrigger>
            </TabsList>

            {/* ── Extracted Fields tab ── */}
            <TabsContent value="fields" className="flex flex-col gap-4 pt-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-muted-foreground">Filename</dt>
                <dd className="break-all">{data.document.filename}</dd>

                <dt className="font-medium text-muted-foreground">MIME type</dt>
                <dd>{data.document.mimeType}</dd>

                <dt className="font-medium text-muted-foreground">Created</dt>
                <dd>{formatDate(data.document.createdAt)}</dd>
              </dl>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-muted-foreground">
                  Full text
                </p>
                <Textarea
                  readOnly
                  value={data.ocr.fullText}
                  className="max-h-40 resize-none overflow-y-auto"
                  aria-label="Full OCR text"
                />
              </div>

              {data.ocr.blocks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-muted-foreground">
                    Blocks
                  </p>
                  <ul className="flex flex-col gap-2">
                    {data.ocr.blocks.map((block) => (
                      <li
                        key={block.id}
                        className="rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span>{block.text}</span>
                        {block.confidence !== undefined && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({Math.round(block.confidence * 100)}% confidence)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            {/* ── Form to Complete tab ── */}
            <TabsContent value="form" className="flex flex-col gap-4 pt-4">
              {data.fieldCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No extracted fields available.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {data.fieldCandidates.map((fc) => {
                    const fieldId = `candidate-field-${fc.id}`;
                    const value = fieldValues[fc.id];
                    const isEmpty =
                      validationError !== null &&
                      (!value || value.trim() === "");

                    return (
                      <div key={fc.id} className="flex flex-col gap-1.5">
                        <Label htmlFor={fieldId}>{fc.key}</Label>
                        <Input
                          id={fieldId}
                          type="text"
                          value={value ?? ""}
                          onChange={(e) =>
                            handleFieldChange(fc.id, e.target.value)
                          }
                          className={isEmpty ? "border-destructive" : ""}
                          aria-invalid={isEmpty}
                          aria-describedby={
                            isEmpty ? "form-validation-error" : undefined
                          }
                          placeholder="Enter value…"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div aria-live="polite">
                {validationError && (
                  <Alert
                    variant="destructive"
                    id="form-validation-error"
                  >
                    <AlertTitle>Incomplete form</AlertTitle>
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                {isSubmitted && (
                  <Alert role="status">
                    <AlertTitle>Submitted successfully</AlertTitle>
                    <AlertDescription>
                      All fields have been recorded.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={data.fieldCandidates.length === 0}
                >
                  Submit
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
