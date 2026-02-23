"use client";

import { useState } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatThread } from "@/components/chat/chat-thread";
import { ChatComposer } from "@/components/chat/chat-composer";
import { Button } from "@/components/ui/button";
import { mockMessages, mockAttachmentChips } from "@/lib/mock-chat-data";

export default function Home() {
  const [showTypingDemo, setShowTypingDemo] = useState(false);
  const [messages, setMessages] = useState(mockMessages);
  const [isExpanded, setIsExpanded] = useState(true);

  const chatContent = (
    <>
      <ChatHeader
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded((v) => !v)}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <ChatThread messages={messages} isTyping={showTypingDemo} />
        <div className="flex flex-col gap-0">
          <div className="flex justify-center gap-2 py-2 border-t border-border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setShowTypingDemo((v) => !v)}
            >
              {showTypingDemo ? "Hide" : "Show"} typing demo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() =>
                setMessages((m) => (m.length ? [] : mockMessages))
              }
            >
              {messages.length ? "Clear" : "Restore"} chat
            </Button>
          </div>
          <ChatComposer attachmentChips={mockAttachmentChips} />
        </div>
      </div>
    </>
  );

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {isExpanded ? (
        <div className="flex flex-1 flex-col min-h-screen overflow-hidden">
          {chatContent}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex h-[min(80vh,700px)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {chatContent}
          </div>
        </div>
      )}
    </main>
  );
}
