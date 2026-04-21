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

import type { EntityDB } from '@babycommando/entity-db'

/**
 * Internal interface and helper for raw IDB access, bypassing the embedding
 * pipeline. Used by getChatHistory to read records without generating vectors.
 * Mirrors the pattern in entitydb-persist.ts and useDocumentSession.ts.
 */

interface EntityDBInternal {
  dbPromise: Promise<{
    transaction(
      store: string,
      mode: 'readonly' | 'readwrite'
    ): {
      objectStore(name: string): {
        getAll(): Promise<Array<Record<string, unknown>>>
        add(value: object): Promise<IDBValidKey>
      }
    }
  }>
}

function getIdb(): Promise<
  EntityDBInternal['dbPromise'] extends Promise<infer T> ? T : never
> {
  const entityDB: EntityDB = getEntityDB()
  const internal = entityDB as unknown as EntityDBInternal
  return internal.dbPromise
}

const VECTOR_PATH = 'document-assistant'
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'

let _db: EntityDB | null = null

function instantiateEntityDB(): EntityDB {
  // Value-importing `@babycommando/entity-db` at module top level pulls in
  // `@xenova/transformers`, which runs during Next SSR and crashes ONNX/WASM
  // in Node. Load the package only in the browser, inside getEntityDB().
  const { EntityDB: EntityDBCtor } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- browser-only; avoids SSR onnx
    require('@babycommando/entity-db') as typeof import('@babycommando/entity-db')
  return new EntityDBCtor({
    vectorPath: VECTOR_PATH,
    model: EMBEDDING_MODEL,
  })
}

/**
 * Get or create EntityDB instance.
 * Call from client components only.
 */
export function getEntityDB(): EntityDB {
  if (typeof window === 'undefined') {
    throw new Error('EntityDB can only be used in the browser')
  }
  if (!_db) {
    _db = instantiateEntityDB()
  }
  return _db
}

/**
 * Insert a chunk for RAG. EntityDB generates embedding from text.
 * Metadata can include docId, chunkId for entity graph.
 */
export async function insertChunk(
  text: string,
  metadata?: { docId?: string; chunkId?: string }
): Promise<void> {
  const db = getEntityDB()
  await db.insert({
    text,
    ...metadata,
  })
}

/**
 * Semantic search over chunks. Returns similar text by cosine similarity.
 */
export async function queryChunks(
  query: string,
  options?: { limit?: number }
): Promise<
  Array<{ text: string; docId?: string; chunkId?: string; similarity?: number }>
> {
  const db = getEntityDB()
  const limit = options?.limit ?? 5
  const results = await db.query(query, { limit })
  return results.map(
    (r: {
      text?: string
      docId?: string
      chunkId?: string
      similarity?: number
    }) => ({
      text: r.text ?? '',
      docId: r.docId,
      chunkId: r.chunkId,
      similarity: r.similarity,
    })
  )
}

export const CHAT_MESSAGE_ENTITY_KEY = 'chat_message' as const

/**
 * Count vector rows for this document excluding chat history (RAG chunks only).
 * AskTab State 1: no rows ⇒ empty state → Upload (UI flow diagram).
 */
export async function countRagChunksForDoc(docId: string): Promise<number> {
  if (typeof window === 'undefined' || !docId) {
    return 0
  }
  const db = await getIdb()
  const tx = db.transaction('vectors', 'readonly')
  const records = await tx.objectStore('vectors').getAll()
  return records.filter(
    (r) =>
      r['docId'] === docId && r['entityKey'] !== CHAT_MESSAGE_ENTITY_KEY
  ).length
}

/** One retrieved snippet shown in Ask “sources” (Team 1). */
export interface AskSourceRef {
  snippet: string
  chunkId?: string
  /** Start index in original `fullText` for “show in document”. */
  charStart?: number
  matchLen?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** Legacy: string-only snippets (no jump links). */
  sourceChunks?: string[]
  /** Structured sources with optional jump range in original text. */
  sourceRefs?: AskSourceRef[]
  /**
   * Ask-only: whether client RAG used indexed chunks vs whole-document fallback (timeout / empty hits).
   * [Brandi] — data path; [Jasmin] — persisted for overlap + “can’t determine” heuristics (Apr 2026).
   */
  askRagMode?: 'indexed' | 'fulltext_fallback'
}

/**
 * Persist a chat message into EntityDB. Triggers embedding generation so
 * the message content is searchable via queryChunks.
 */
export async function insertChatMessage(
  docId: string,
  message: Pick<ChatMessage, 'role' | 'content'> & {
    sourceChunks?: string[]
    sourceRefs?: AskSourceRef[]
    askRagMode?: ChatMessage['askRagMode']
  }
): Promise<void> {
  const db = getEntityDB()
  await db.insert({
    text: message.content,
    entityKey: CHAT_MESSAGE_ENTITY_KEY,
    docId,
    role: message.role,
    timestamp: Date.now(),
    ...(message.sourceRefs && message.sourceRefs.length > 0
      ? { sourceRefs: message.sourceRefs }
      : {}),
    ...(message.sourceChunks && message.sourceChunks.length > 0
      ? { sourceChunks: message.sourceChunks }
      : {}),
    ...(message.askRagMode ? { askRagMode: message.askRagMode } : {}),
  })
}

/**
 * Retrieve all persisted chat messages for a document, sorted by timestamp ascending.
 * Uses raw IDB access to bypass the embedding pipeline.
 */
export async function getChatHistory(docId: string): Promise<ChatMessage[]> {
  if (typeof window === 'undefined') {
    return []
  }
  const db = await getIdb()
  const tx = db.transaction('vectors', 'readonly')
  const store = tx.objectStore('vectors')
  const records = await store.getAll()

  return records
    .filter(
      (r) => r['entityKey'] === CHAT_MESSAGE_ENTITY_KEY && r['docId'] === docId
    )
    .sort(
      (a, b) =>
        ((a['timestamp'] as number) ?? 0) - ((b['timestamp'] as number) ?? 0)
    )
    .map((r) => {
      const rawChunks = r['sourceChunks']
      const sourceChunks = Array.isArray(rawChunks)
        ? rawChunks.filter((s): s is string => typeof s === 'string')
        : undefined
      const rawRefs = r['sourceRefs']
      let sourceRefs: AskSourceRef[] | undefined
      if (Array.isArray(rawRefs)) {
        sourceRefs = rawRefs
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const o = item as Record<string, unknown>
            const snippet = typeof o.snippet === 'string' ? o.snippet : ''
            if (!snippet) return null
            return {
              snippet,
              ...(typeof o.chunkId === 'string' ? { chunkId: o.chunkId } : {}),
              ...(typeof o.charStart === 'number' ? { charStart: o.charStart } : {}),
              ...(typeof o.matchLen === 'number' ? { matchLen: o.matchLen } : {}),
            } satisfies AskSourceRef
          })
          .filter((x): x is AskSourceRef => x != null)
        if (sourceRefs.length === 0) sourceRefs = undefined
      }
      const rawRagMode = r['askRagMode']
      const askRagMode =
        rawRagMode === 'indexed' || rawRagMode === 'fulltext_fallback'
          ? rawRagMode
          : undefined

      return {
        role: r['role'] as ChatMessage['role'],
        content: r['text'] as string,
        timestamp: r['timestamp'] as number,
        ...(sourceChunks && sourceChunks.length > 0 ? { sourceChunks } : {}),
        ...(sourceRefs && sourceRefs.length > 0 ? { sourceRefs } : {}),
        ...(askRagMode ? { askRagMode } : {}),
      }
    })
}
