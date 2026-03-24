"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { queryChunks } from "@/lib/entitydb";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const transport = new DefaultChatTransport({ api: "/api/ask" });

function getMessageText(
  parts: { type: string; text?: string }[]
): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function QAPanel(): React.ReactElement {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, status, error, sendMessage } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const question = input;
    setInput("");

    const results = await queryChunks(question);
    const chunks = results.map((r) => r.text);

    await sendMessage({ text: question }, { body: { chunks } });
  }

  return (
    <Card className="flex w-full flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>Document Q&amp;A</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 && !isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ask a question about your document to get started.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              const text = getMessageText(
                message.parts as { type: string; text?: string }[]
              );
              if (!text && message.role !== "user") return null;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {text || (
                      <Spinner
                        className="size-3.5"
                        aria-label="Generating answer"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Spinner className="size-3.5" aria-label="Generating answer" />
                  <span>Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <div className="flex flex-col gap-3 border-t px-6 py-4">
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        <CardFooter className="p-0">
          <form onSubmit={onSubmit} className="flex w-full gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your document…"
              disabled={isLoading}
              aria-label="Question input"
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Send question"
              size="icon"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </form>
        </CardFooter>
      </div>
    </Card>
  );
}
