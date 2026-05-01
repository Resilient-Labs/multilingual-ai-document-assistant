'use client'

/**
 * useDocumentSession — retrieves the canonical extracted document from the
 * local EntityDB IndexedDB store on mount.
 *
 * Storage convention: records stored with { entityKey: "extracted_document", ...docData }.
 * EntityDB uses an auto-increment numeric IDB key; we identify the target record
 * by the metadata field `entityKey` rather than by the IDB key itself.
 *
 * We access the raw IDB connection via EntityDB's public `dbPromise` property to
 * avoid triggering the ML embedding pipeline (which `insert`/`query` would do).
 */

import { useEffect, useState } from 'react'
import { getEntityDB } from '@/lib/entitydb'
import {
  ENTITYDB_VECTORS_STORE,
  getIdbFrom,
} from '@/lib/entitydb-idb'
import type { CanonicalDocument } from '@/types/CanonicalDocument'

/** The metadata field used to identify the extracted-document record. */
const EXTRACTED_DOCUMENT_KEY = 'extracted_document' as const

export interface UseDocumentSessionResult {
  data: CanonicalDocument | null
  loading: boolean
  error: string | null
}

const IS_BROWSER = typeof window !== 'undefined'

export function useDocumentSession(
  sessionId?: string
): UseDocumentSessionResult {
  const [data, setData] = useState<CanonicalDocument | null>(null)
  const [loading, setLoading] = useState<boolean>(IS_BROWSER)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!IS_BROWSER) return

    setData(null)
    setError(null)
    setLoading(true)

    let cancelled = false

    async function fetchDocument(): Promise<void> {
      try {
        const idb = await getIdbFrom(getEntityDB())

        const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
        const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
        const records = await store.getAll()

        if (cancelled) return

        const match = records.find((r) => {
          if (r['entityKey'] !== EXTRACTED_DOCUMENT_KEY) return false
          if (sessionId) {
            const doc = r['document'] as { id?: string } | undefined
            return doc?.id === sessionId
          }
          return true
        })

        if (!match) {
          setData(null)
        } else {
          const payload = { ...match }
          delete payload.id
          delete payload.vector
          delete payload.entityKey
          delete payload.text
          setData(payload as unknown as CanonicalDocument)
        }
      } catch (err: unknown) {
        if (cancelled) return
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to read document from local store'
        setError(message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchDocument()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  return { data, loading, error }
}
