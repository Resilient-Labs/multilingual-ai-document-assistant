"use client";

/**
 * useChatHistory — loads persisted chat messages for a document on mount and
 * exposes addMessage to persist new entries.
 *
 * Storage: EntityDB records with { entityKey: "chat_message", docId, role, timestamp }.
 * Follows the cancelled-flag cleanup pattern from useDocumentSession.ts.
 */

import { useEffect, useState, useCallback } from "react";
import {
  getChatHistory,
  insertChatMessage,
  type ChatMessage,
} from "@/lib/entitydb";

export interface UseChatHistoryResult {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  addMessage: (role: ChatMessage["role"], content: string) => Promise<void>;
}

const IS_BROWSER = typeof window !== "undefined";

export function useChatHistory(docId: string): UseChatHistoryResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(IS_BROWSER);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_BROWSER) return;

    setMessages([]);
    setError(null);
    setLoading(true);

    let cancelled = false;

    async function loadHistory(): Promise<void> {
      try {
        const history = await getChatHistory(docId);
        if (!cancelled) {
          setMessages(history);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load chat history from local store";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [docId]);

  const addMessage = useCallback(
    async (role: ChatMessage["role"], content: string): Promise<void> => {
      const timestamp = Date.now();
      await insertChatMessage(docId, { role, content });
      setMessages((prev) => [...prev, { role, content, timestamp }]);
    },
    [docId]
  );

  return { messages, loading, error, addMessage };
}
