"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { QuickSummaryCard } from "./quick-summary-card";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
}

export interface ChatThreadProps {
  messages: ChatMessage[];
  isTyping?: boolean;
  className?: string;
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
        AI
      </div>
      <div className="rounded-lg border border-chat-assistant-border bg-chat-typing px-4 py-3 text-sm text-muted-foreground">
        <span className="inline-flex gap-1">
          <span className="animate-pulse">Analyzing document context</span>
          <span className="inline-flex">
            <span className="animate-bounce [animation-delay:-0.3s]">.</span>
            <span className="animate-bounce [animation-delay:-0.15s]">.</span>
            <span className="animate-bounce">.</span>
          </span>
        </span>
      </div>
    </div>
  );
}

const emptyStateSuggestions = [
  "What requirements should I verify before translating?",
  "Summarize the key terms in my document",
  "What information might be missing from my contract?",
  "Help me understand ambiguous clauses for translation",
];

export function ChatThread({
  messages,
  isTyping = false,
  className,
}: ChatThreadProps) {
  const isEmpty = messages.length === 0 && !isTyping;

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div className="flex flex-col py-4">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Ask about your document
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste text, add images, or insert links to get clarification on
              requirements and missing information.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {emptyStateSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
              />
            ))}
            {isTyping && <TypingIndicator />}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
