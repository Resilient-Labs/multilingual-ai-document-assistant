'use client'

/**
 * Persist OCR output and document metadata into EntityDB (IndexedDB) without
 * running the embedding pipeline. Uses the same "vectors" store and
 * entityKey convention as useDocumentSession.
 */

import type { EntityDB } from '@babycommando/entity-db'
import { getEntityDB } from '@/lib/entitydb'
import { extractFieldCandidates } from '@/lib/documents/fieldCandidates'
import type { CanonicalDocument } from '@/types/CanonicalDocument'
import type { Document, OCRResult } from '@/types'

/** Xenova/all-MiniLM-L6-v2 embedding size — keeps EntityDB.query from breaking on length mismatch. */
const PLACEHOLDER_EMBEDDING_DIM = 384

/** Unit-ish placeholder so cosine similarity with query vectors stays finite. */
function placeholderVector(): number[] {
  const v = 1 / Math.sqrt(PLACEHOLDER_EMBEDDING_DIM)
  return Array.from({ length: PLACEHOLDER_EMBEDDING_DIM }, () => v)
}

export const EXTRACTED_DOCUMENT_ENTITY_KEY = 'extracted_document' as const

export interface PersistOCRParams {
  docId: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: number
  ocr: OCRResult
  file?: File
}

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

export function fileToDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(undefined)
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function buildDocument(params: PersistOCRParams): Document {
  return {
    id: params.docId,
    filename: params.filename,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    createdAt: params.createdAt,
  }
}

/** Builds the canonical payload; exported for unit tests. */
export async function buildCanonicalPersistPayload(
  params: PersistOCRParams
): Promise<{
  record: Record<string, unknown>
  canonical: CanonicalDocument
}> {
  const document = buildDocument(params)
  const blocks = params.ocr.blocks.map((b) => ({
    ...b,
    documentId: params.docId,
  }))
  const ocr: OCRResult = {
    ...params.ocr,
    documentId: params.docId,
    blocks,
  }
  const fieldCandidates = extractFieldCandidates(params.docId, blocks)
  const imageDataUrl = params.file
    ? await fileToDataUrl(params.file)
    : undefined

  const canonical: CanonicalDocument = {
    document,
    ocr,
    files: [],
    fieldCandidates,
    extractedAt: params.createdAt,
    updatedAt: params.createdAt,
  }

  const record: Record<string, unknown> = {
    entityKey: EXTRACTED_DOCUMENT_ENTITY_KEY,
    text: ocr.fullText,
    vector: placeholderVector(),
    ...canonical,
  }

  if (imageDataUrl !== undefined) {
    record.imageDataUrl = imageDataUrl
  }

  return { record, canonical }
}

export async function persistOCRToEntityDB(
  params: PersistOCRParams
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('persistOCRToEntityDB can only run in the browser')
  }

  const { record } = await buildCanonicalPersistPayload(params)
  const db = await getIdb()
  const tx = db.transaction('vectors', 'readwrite')
  const store = tx.objectStore('vectors')
  await store.add(record)
}

export async function getDocumentFromEntityDB(
  docId: string
): Promise<CanonicalDocument | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const db = await getIdb()
  const tx = db.transaction('vectors', 'readonly')
  const store = tx.objectStore('vectors')
  const records = await store.getAll()

  const match = records.find((r) => {
    if (r['entityKey'] !== EXTRACTED_DOCUMENT_ENTITY_KEY) return false
    const doc = r['document'] as { id?: string } | undefined
    return doc?.id === docId
  })

  if (!match) return null

  const payload = { ...match }
  delete payload.id
  delete payload.vector
  delete payload.entityKey
  delete payload.text
  return payload as unknown as CanonicalDocument
}
