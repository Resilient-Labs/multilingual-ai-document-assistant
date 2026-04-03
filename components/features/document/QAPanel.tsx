"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { Send } from "lucide-react";
import { queryChunks } from "@/lib/entitydb";
import type { ChatMessage } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function QAPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const question = input.trim();
      if (!question || isLoading) return;

      setInput("");

      const userMessage: ChatMessage = {
        role: "user",
        message: question,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const chunks = await queryChunks(question, { limit: 5 });

        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            chunks: chunks.map((c) => c.text),
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        const isStream =
          contentType.includes("text/event-stream") ||
          contentType.includes("text/plain");

        if (isStream && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          const streamingMessage: ChatMessage = {
            role: "assistant",
            message: "",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, streamingMessage]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                message: accumulated,
              };
              return updated;
            });
          }
        } else {
          const data = await response.json();
          const assistantMessage: ChatMessage = {
            role: "assistant",
            message: data.answer ?? "No answer returned.",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        const errorText =
          err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            message: `Error: ${errorText}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading]
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Ask about this document</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div
            ref={scrollRef}
            aria-live="polite"
            className="flex flex-col gap-3 px-4 py-2"
          >
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ask a question about the document to get started.
              </p>
            )}

            {messages.map((msg, i) => (
              <div
                key={`${msg.timestamp}-${i}`}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted text-foreground"
                )}
              >
                {msg.message}
              </div>
            ))}

            {isLoading &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Thinking&hellip;
                </div>
              )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter>
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            aria-label="Ask a question about the document"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            aria-disabled={isLoading || !input.trim()}
            aria-label="Send question"
          >
            {isLoading ? <Spinner className="size-4" /> : <Send />}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
