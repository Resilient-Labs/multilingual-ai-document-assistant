'use client'

import { useCallback, useEffect, useState } from 'react'

import { getEntityDB } from '@/lib/entitydb'
import {
  ENTITYDB_VECTORS_STORE,
  getIdbFrom,
  placeholderEmbeddingVector,
} from '@/lib/entitydb-idb'

const USER_LANGUAGE_PREFERENCE_KEY = 'user_language_preference' as const
const IS_BROWSER = typeof window !== 'undefined'

export interface UseLanguagePreferenceResult {
  preferredLanguage: string | null
  setLanguage: (language: string) => Promise<void>
  loading: boolean
  error: string | null
}

function getUpdatedAt(record: Record<string, unknown>): number {
  return typeof record['updatedAt'] === 'number' ? record['updatedAt'] : 0
}

function getPreferredLanguage(records: Array<Record<string, unknown>>): string | null {
  const latest = records
    .filter((record) => record['entityKey'] === USER_LANGUAGE_PREFERENCE_KEY)
    .sort((a, b) => getUpdatedAt(b) - getUpdatedAt(a))[0]

  return typeof latest?.['preferredLanguage'] === 'string'
    ? latest['preferredLanguage']
    : null
}

export function useLanguagePreference(): UseLanguagePreferenceResult {
  const [preferredLanguage, setPreferredLanguage] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(IS_BROWSER)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!IS_BROWSER) return

    let cancelled = false

    async function loadPreference(): Promise<void> {
      setLoading(true)

      try {
        const db = await getIdbFrom(getEntityDB())
        const tx = db.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
        const records = await tx.objectStore(ENTITYDB_VECTORS_STORE).getAll()

        if (!cancelled) {
          setPreferredLanguage(getPreferredLanguage(records))
        }
      } catch (err: unknown) {
        if (cancelled) return
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load language preference from local store'
        setError(message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPreference()

    return () => {
      cancelled = true
    }
  }, [])

  const setLanguage = useCallback(async (language: string): Promise<void> => {
    if (!IS_BROWSER) return

    const updatedAt = Date.now()
    const db = await getIdbFrom(getEntityDB())
    const tx = db.transaction(ENTITYDB_VECTORS_STORE, 'readwrite')

    const store = tx.objectStore(ENTITYDB_VECTORS_STORE)

    const records = await store.getAll()
    for (const record of records) {
      if (
        record['entityKey'] === USER_LANGUAGE_PREFERENCE_KEY &&
        typeof record['id'] === 'number'
      ) {
        await store.delete(record['id'] as IDBValidKey)
      }
    }

    await store.add({
      entityKey: USER_LANGUAGE_PREFERENCE_KEY,
      text: language,
      vector: placeholderEmbeddingVector(),
      preferredLanguage: language,
      updatedAt,
    })

    setPreferredLanguage(language)
  }, [])

  return { preferredLanguage, setLanguage, loading, error }
}
