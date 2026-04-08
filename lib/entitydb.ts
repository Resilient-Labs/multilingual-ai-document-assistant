/**
 * EntityDB client for in-browser storage.
 * Architecture: Zero-retention. All persistent data lives in EntityDB (IndexedDB + vectors).
 *
 * Use in client components only (browser API).
 *
 * EntityDB stores chunks + embeddings for RAG. Document metadata and OCR blocks
 * are stored as EntityDB entries with metadata (docId, entityType, etc.).
 *
 * @see https://github.com/babycommando/entity-db
 */

import { EntityDB } from "@babycommando/entity-db";

/**
 * Internal interface and helper for raw IDB access, bypassing the embedding
 * pipeline. Used by getChatHistory to read records without generating vectors.
 * Mirrors the pattern in entitydb-persist.ts and useDocumentSession.ts.
 */

interface EntityDBInternal {
  dbPromise: Promise<{
    transaction(
      store: string,
      mode: "readonly" | "readwrite"
    ): {
      objectStore(name: string): {
        getAll(): Promise<Array<Record<string, unknown>>>;
        add(value: object): Promise<IDBValidKey>;
      };
    };
  }>;
}

function getIdb(): Promise<EntityDBInternal["dbPromise"] extends Promise<infer T> ? T : never> {
  const entityDB: EntityDB = getEntityDB();
  const internal = entityDB as unknown as EntityDBInternal;
  return internal.dbPromise;
}

const VECTOR_PATH = "document-assistant";
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

let _db: EntityDB | null = null;

/**
 * Get or create EntityDB instance.
 * Call from client components only.
 */
export function getEntityDB(): EntityDB {
  if (typeof window === "undefined") {
    throw new Error("EntityDB can only be used in the browser");
  }
  if (!_db) {
    _db = new EntityDB({
      vectorPath: VECTOR_PATH,
      model: EMBEDDING_MODEL,
    });
  }
  return _db;
}

/**
 * Insert a chunk for RAG. EntityDB generates embedding from text.
 * Metadata can include docId, chunkId for entity graph.
 */
export async function insertChunk(
  text: string,
  metadata?: { docId?: string; chunkId?: string }
): Promise<void> {
  const db = getEntityDB();
  await db.insert({
    text,
    ...metadata,
  });
}

/**
 * Semantic search over chunks. Returns similar text by cosine similarity.
 */
export async function queryChunks(
  query: string,
  options?: { limit?: number }
): Promise<Array<{ text: string; docId?: string; chunkId?: string; similarity?: number }>> {
  const db = getEntityDB();
  const limit = options?.limit ?? 5;
  const results = await db.query(query, { limit });
  return results.map((r: { text?: string; docId?: string; chunkId?: string; similarity?: number }) => ({
    text: r.text ?? "",
    docId: r.docId,
    chunkId: r.chunkId,
    similarity: r.similarity,
  }));
}

export const CHAT_MESSAGE_ENTITY_KEY = "chat_message" as const;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Persist a chat message into EntityDB. Triggers embedding generation so
 * the message content is searchable via queryChunks.
 */
export async function insertChatMessage(
  docId: string,
  message: Pick<ChatMessage, "role" | "content">
): Promise<void> {
  const db = getEntityDB();
  await db.insert({
    text: message.content,
    entityKey: CHAT_MESSAGE_ENTITY_KEY,
    docId,
    role: message.role,
    timestamp: Date.now(),
  });
}

/**
 * Retrieve all persisted chat messages for a document, sorted by timestamp ascending.
 * Uses raw IDB access to bypass the embedding pipeline.
 */
export async function getChatHistory(docId: string): Promise<ChatMessage[]> {
  if (typeof window === "undefined") {
    return [];
  }
  const db = await getIdb();
  const tx = db.transaction("vectors", "readonly");
  const store = tx.objectStore("vectors");
  const records = await store.getAll();

  return records
    .filter(
      (r) =>
        r["entityKey"] === CHAT_MESSAGE_ENTITY_KEY &&
        r["docId"] === docId
    )
    .sort((a, b) => ((a["timestamp"] as number) ?? 0) - ((b["timestamp"] as number) ?? 0))
    .map((r) => ({
      role: r["role"] as ChatMessage["role"],
      content: r["text"] as string,
      timestamp: r["timestamp"] as number,
    }));
}
