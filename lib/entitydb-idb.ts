'use client'

/**
 * Raw IndexedDB access for EntityDB's `vectors` store (same connection as
 * `@babycommando/entity-db`), without running the embedding pipeline.
 */

import type { EntityDB } from '@babycommando/entity-db'

export const ENTITYDB_VECTORS_STORE = 'vectors' as const

/** Translate flow session rows in the vectors store (not RAG chunks). */
export const TRANSLATE_SESSION_ENTITY_KEY = 'translate_session' as const

/** Xenova/all-MiniLM-L6-v2 embedding size — keeps EntityDB.query from breaking on length mismatch. */
const PLACEHOLDER_EMBEDDING_DIM = 384

/** Unit-ish placeholder so cosine similarity with query vectors stays finite. */
export function placeholderEmbeddingVector(): number[] {
  const v = 1 / Math.sqrt(PLACEHOLDER_EMBEDDING_DIM)
  return Array.from({ length: PLACEHOLDER_EMBEDDING_DIM }, () => v)
}

export interface EntityDBVectorsObjectStore {
  get(key: IDBValidKey): Promise<unknown>
  getAll(): Promise<Array<Record<string, unknown>>>
  add(value: object): Promise<IDBValidKey>
  delete(key: IDBValidKey): Promise<void>
}

export interface EntityDBIdb {
  transaction(
    store: typeof ENTITYDB_VECTORS_STORE,
    mode: 'readonly' | 'readwrite'
  ): {
    objectStore(
      name: typeof ENTITYDB_VECTORS_STORE
    ): EntityDBVectorsObjectStore
  }
}

/**
 * Resolve the app document id for a vectors row (RAG/chat rows use `docId`;
 * extracted canonical rows use `document.id`).
 */
export function resolveRecordDocId(
  record: Record<string, unknown>
): string | undefined {
  if (typeof record.docId === 'string') return record.docId
  const doc = record.document
  if (
    doc &&
    typeof doc === 'object' &&
    doc !== null &&
    typeof (doc as { id?: unknown }).id === 'string'
  ) {
    return (doc as { id: string }).id
  }
  return undefined
}

/**
 * Returns the raw IDB handle behind an EntityDB instance.
 */
export async function getIdbFrom(entityDB: EntityDB): Promise<EntityDBIdb> {
  const internal = entityDB as unknown as { dbPromise: Promise<EntityDBIdb> }
  return internal.dbPromise
}

/**
 * Deletes every row in the vectors store whose resolved document id matches
 * `docId` (RAG chunks, chat, translate session cache, extracted document, etc.).
 */
export async function deleteAllVectorsForDocId(
  entityDB: EntityDB,
  docId: string
): Promise<void> {
  if (typeof window === 'undefined' || !docId) {
    return
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readwrite')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const records = await store.getAll()
  for (const r of records) {
    if (resolveRecordDocId(r) === docId && typeof r.id === 'number') {
      await store.delete(r.id)
    }
  }
}
