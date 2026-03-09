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
