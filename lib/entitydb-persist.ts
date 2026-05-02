'use client'

/**
 * Persist OCR output and document metadata into EntityDB (IndexedDB) without
 * running the embedding pipeline. Uses the same "vectors" store and
 * entityKey convention as useDocumentSession.
 */

import { getEntityDB } from '@/lib/entitydb'
import {
  ENTITYDB_VECTORS_STORE,
  getIdbFrom,
  placeholderEmbeddingVector,
} from '@/lib/entitydb-idb'
import { extractFieldCandidates } from '@/lib/documents/fieldCandidates'
import type { CanonicalDocument } from '@/types/CanonicalDocument'
import type { Document, OCRResult } from '@/types'

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
    vector: placeholderEmbeddingVector(),
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
  const db = await getIdbFrom(getEntityDB())
  const tx = db.transaction(ENTITYDB_VECTORS_STORE, 'readwrite')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  await store.add(record)
}

/** One row per document id for landing / “open recent” lists. */
export interface SavedDocumentListItem {
  docId: string
  filename: string
  extractedAt: number
}

/**
 * All canonical extracted documents currently in the vectors store (browser only).
 * Deduplicates by `document.id`, keeping the row with the latest `extractedAt` / `updatedAt`.
 */
export async function listSavedDocumentsFromEntityDB(): Promise<
  SavedDocumentListItem[]
> {
  if (typeof window === 'undefined') {
    return []
  }

  const db = await getIdbFrom(getEntityDB())
  const tx = db.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const records = await store.getAll()

  const byDocId = new Map<string, SavedDocumentListItem>()

  for (const r of records) {
    if (r['entityKey'] !== EXTRACTED_DOCUMENT_ENTITY_KEY) continue
    const doc = r['document'] as { id?: string; filename?: string } | undefined
    const id = doc?.id
    if (!id || typeof doc.filename !== 'string') continue

    const extractedAt =
      typeof r['extractedAt'] === 'number'
        ? r['extractedAt']
        : typeof r['updatedAt'] === 'number'
          ? r['updatedAt']
          : 0

    const prev = byDocId.get(id)
    if (!prev || extractedAt >= prev.extractedAt) {
      byDocId.set(id, {
        docId: id,
        filename: doc.filename,
        extractedAt,
      })
    }
  }

  return Array.from(byDocId.values()).sort(
    (a, b) => b.extractedAt - a.extractedAt
  )
}

export async function getDocumentFromEntityDB(
  docId: string
): Promise<CanonicalDocument | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const db = await getIdbFrom(getEntityDB())
  const tx = db.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
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
