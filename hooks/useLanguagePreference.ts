'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EntityDB } from '@babycommando/entity-db'

import { getEntityDB } from '@/lib/entitydb'

const USER_LANGUAGE_PREFERENCE_KEY = 'user_language_preference' as const
const PLACEHOLDER_EMBEDDING_DIM = 384

function placeholderVector(): number[] {
  const v = 1 / Math.sqrt(PLACEHOLDER_EMBEDDING_DIM)
  return Array.from({ length: PLACEHOLDER_EMBEDDING_DIM }, () => v)
}
const IS_BROWSER = typeof window !== 'undefined'

interface EntityDBInternal {
  dbPromise: Promise<{
    transaction(
      store: string,
      mode: 'readonly' | 'readwrite'
    ): {
      objectStore(name: string): {
        add(value: object): Promise<IDBValidKey>
        delete(key: IDBValidKey): Promise<void>
        getAll(): Promise<Array<Record<string, unknown>>>
      }
    }
  }>
}

export interface UseLanguagePreferenceResult {
  preferredLanguage: string | null
  setLanguage: (language: string) => Promise<void>
  loading: boolean
  error: string | null
}

function getIdb(): Promise<
  EntityDBInternal['dbPromise'] extends Promise<infer T> ? T : never
> {
  const entityDB: EntityDB = getEntityDB()
  const internal = entityDB as unknown as EntityDBInternal
  return internal.dbPromise
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
        const db = await getIdb()
        const tx = db.transaction('vectors', 'readonly')
        const records = await tx.objectStore('vectors').getAll()

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
    const db = await getIdb()
    const tx = db.transaction('vectors', 'readwrite')

    const store = tx.objectStore('vectors')

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
      vector: placeholderVector(),
      preferredLanguage: language,
      updatedAt,
    })

    setPreferredLanguage(language)
  }, [])

  return { preferredLanguage, setLanguage, loading, error }
}
