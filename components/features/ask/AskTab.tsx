"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { queryChunks } from "@/lib/entitydb";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface AskTabProps {
  docId: string;
  fullText: string;
  className?: string;
}

export function AskTab({ docId, fullText, className }: AskTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setIsLoading(true);

    let chunks: string[];
    try {
      const results = await Promise.race([
        queryChunks(question, { limit: 5 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("queryChunks timeout")), 3000),
        ),
      ]);
      chunks = results.length > 0 ? results.map((r) => r.text) : [fullText];
    } catch {
      chunks = [fullText];
    }

    // Append a placeholder assistant message to stream tokens into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, chunks }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? "Request failed");
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Try to detect JSON (non-streaming) response from current API
        let displayText = accumulated;
        try {
          const parsed = JSON.parse(accumulated) as { answer?: string };
          if (parsed.answer !== undefined) {
            displayText = parsed.answer;
          }
        } catch {
          // Not complete JSON yet — treat as streaming tokens
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: displayText };
          return updated;
        });
      }

      // Final parse attempt after stream closes
      try {
        const parsed = JSON.parse(accumulated) as { answer?: string };
        if (parsed.answer !== undefined) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: parsed.answer! };
            return updated;
          });
        }
      } catch {
        // Already streamed as raw tokens — nothing to do
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // Remove the empty placeholder on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, fullText]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <Card className={cn("flex w-full flex-col overflow-hidden", className)}>
      <CardHeader>
        <CardTitle>Ask about this document</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Message list */}
        <div className="flex max-h-80 min-h-[120px] flex-col gap-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask a question about the document above.
            </p>
          )}

          {messages.map((msg, i) => {
            const isAssistant = msg.role === "assistant";
            const isLastAssistant = isAssistant && i === messages.length - 1 && isLoading;

            return (
              <div
                key={i}
                className={cn(
                  "flex",
                  isAssistant ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    isAssistant
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {isLastAssistant && msg.content === "" ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Spinner className="size-3" aria-hidden="true" />
                      Thinking...
                    </span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Input row */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            disabled={isLoading}
            aria-label="Question input"
            className="flex-1"
          />
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isLoading || !input.trim()}
            className="shrink-0"
          >
            {isLoading ? <Spinner className="size-4" aria-hidden="true" /> : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
