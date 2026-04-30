import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { OCRResult, SafetyAnalysisResponse } from '@/types'

const { storedRecords, mockDb, resetStore, lsStore, memoryLocalStorage } =
  vi.hoisted(() => {
  const storedRecords: Record<string, unknown>[] = []
  const nextIdRef = { n: 1 }
  const lsStore: Record<string, string> = {}
  const memoryLocalStorage = {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(lsStore, key)
        ? lsStore[key]!
        : null
    },
    setItem(key: string, value: string) {
      lsStore[key] = value
    },
    removeItem(key: string) {
      delete lsStore[key]
    },
    clearLs() {
      for (const k of Object.keys(lsStore)) delete lsStore[k]
    },
  }

  const mockDb = {
    transaction(_store: string, _mode: string) {
      return {
        objectStore(_name: string) {
          return {
            getAll: async () => [...storedRecords],
            get: async (key: IDBValidKey) => {
              const id = Number(key)
              return storedRecords.find((r) => r.id === id)
            },
            add: async (record: object) => {
              const id = nextIdRef.n++
              const r = { ...(record as Record<string, unknown>), id }
              storedRecords.push(r)
              return id
            },
            delete: async (key: IDBValidKey) => {
              const id = Number(key)
              const i = storedRecords.findIndex((r) => r.id === id)
              if (i >= 0) storedRecords.splice(i, 1)
            },
          }
        },
      }
    },
  }
  return {
    storedRecords,
    mockDb,
    lsStore,
    memoryLocalStorage,
    resetStore: () => {
      storedRecords.length = 0
      nextIdRef.n = 1
      memoryLocalStorage.clearLs()
    },
    nextIdRef,
  }
})

vi.mock('@/lib/entitydb', () => ({
  getEntityDB: vi.fn(() => ({
    dbPromise: Promise.resolve(mockDb),
  })),
}))

import {
  CACHE_ROW_VERSION,
  getTranslateSessionByDocId,
  getTranslateSessionByStoredId,
  persistTranslateSessionCache,
  persistTranslationCache,
  persistSummaryCache,
  persistSafetyCache,
  readCachedTranslation,
  readCachedSummary,
  readCachedSafety,
  translationInputFingerprint,
  summaryInputFingerprint,
  safetyInputFingerprint,
  translateCacheIdsStorageKey,
  TRANSLATION_CACHE_ENTITY_KEY,
  TRANSLATE_SESSION_ENTITY_KEY,
} from './entitydb-translate-cache'
import { deleteAllVectorsForDocId, resolveRecordDocId } from './entitydb-idb'
import { getEntityDB } from './entitydb'

function minimalSafetyResponse(): SafetyAnalysisResponse {
  return {
    flags: {
      category: 'test',
      severity: 'low',
      detectedAt: 1,
      nextSteps: [],
    },
    presentation: {
      headline: 'h',
      severityLabel: 'low',
      summary: null,
      primaryActions: [],
      resources: [],
      disclaimer: 'd',
    },
  }
}

describe('entitydb-translate-cache', () => {
  beforeEach(() => {
    resetStore()
    vi.stubGlobal('localStorage', memoryLocalStorage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis, {
        localStorage: memoryLocalStorage,
      }) as Window & typeof globalThis,
    )
  })

  it('persist sets cacheVersion and getByStoredId validates row', async () => {
    const db = getEntityDB()
    const id = await persistTranslateSessionCache(db, 'doc_a', {
      fullText: 'Hello',
      filename: 'f.txt',
      sourceLang: 'en',
      targetLang: 'es',
    })
    expect(id).toBe(1)
    expect(storedRecords[0].cacheVersion).toBe(CACHE_ROW_VERSION)
    expect(storedRecords[0].entityKey).toBe(TRANSLATE_SESSION_ENTITY_KEY)

    const back = await getTranslateSessionByStoredId(db, id)
    expect(back).toEqual({
      fullText: 'Hello',
      filename: 'f.txt',
      sourceLang: 'en',
      targetLang: 'es',
    })
  })

  it('getByStoredId returns null when cacheVersion mismatches', async () => {
    const db = getEntityDB()
    await persistTranslateSessionCache(db, 'doc_b', {
      fullText: 'x',
      filename: 'x',
      sourceLang: 'en',
      targetLang: 'fr',
    })
    storedRecords[0].cacheVersion = 0

    const back = await getTranslateSessionByStoredId(db, 1)
    expect(back).toBeNull()
  })

  it('getTranslateSessionByDocId uses getAll and picks latest cachedAt', async () => {
    const db = getEntityDB()
    await persistTranslateSessionCache(db, 'doc_c', {
      fullText: 'old',
      filename: 'a',
      sourceLang: 'en',
      targetLang: 'de',
    })
    storedRecords[0].cachedAt = 100

    await persistTranslateSessionCache(db, 'doc_c', {
      fullText: 'new',
      filename: 'b',
      sourceLang: 'en',
      targetLang: 'de',
    })
    storedRecords[1].cachedAt = 200

    const back = await getTranslateSessionByDocId(db, 'doc_c')
    expect(back?.fullText).toBe('new')
  })

  it('deleteAllVectorsForDocId removes rows for docId', async () => {
    const db = getEntityDB()
    await persistTranslateSessionCache(db, 'doc_del', {
      fullText: 't',
      filename: 't',
      sourceLang: 'en',
      targetLang: 'vi',
    })
    storedRecords.push({
      id: 99,
      docId: 'doc_del',
      text: 'chunk',
      entityKey: undefined,
    })

    await deleteAllVectorsForDocId(db, 'doc_del')
    expect(storedRecords).toHaveLength(0)
  })

  it('persistTranslationCache merges translationId and readCachedTranslation round-trips', async () => {
    const db = getEntityDB()
    const docId = 'doc_tr'
    const fp = translationInputFingerprint('hello world', 'es')
    await persistTranslationCache(db, docId, fp, 'hola mundo')

    const key = translateCacheIdsStorageKey(docId)
    const map = JSON.parse(lsStore[key]!) as { translationId?: number }
    expect(map.translationId).toBe(1)
    expect(storedRecords[0].id).toBe(1)

    const hit = await readCachedTranslation(db, docId, fp)
    expect(hit).toBe('hola mundo')
  })

  it('readCachedTranslation misses when fingerprint does not match', async () => {
    const db = getEntityDB()
    const docId = 'doc_miss'
    const fpA = translationInputFingerprint('a', 'en')
    const fpB = translationInputFingerprint('b', 'en')
    await persistTranslationCache(db, docId, fpA, 'only-a')

    expect(await readCachedTranslation(db, docId, fpB)).toBeNull()
  })

  it('readCachedTranslation uses getAll fallback when stored id row fails validation', async () => {
    const db = getEntityDB()
    const docId = 'doc_fb'
    const fp = translationInputFingerprint('body', 'de')
    await persistTranslationCache(db, docId, fp, 'Guten Tag')

    const row = storedRecords[0] as Record<string, unknown>
    row.translationFingerprint = 'deadbeef'

    const viaScan = await readCachedTranslation(db, docId, fp)
    expect(viaScan).toBeNull()

    storedRecords.push({
      id: 50,
      entityKey: TRANSLATION_CACHE_ENTITY_KEY,
      docId,
      translationFingerprint: fp,
      translatedText: 'from-scan',
      cacheVersion: CACHE_ROW_VERSION,
      cachedAt: 999,
    })
    lsStore[translateCacheIdsStorageKey(docId)] = JSON.stringify({
      translationId: 1,
    })

    expect(await readCachedTranslation(db, docId, fp)).toBe('from-scan')
  })

  it('readCachedTranslation misses when cacheVersion on row is stale', async () => {
    const db = getEntityDB()
    const docId = 'doc_cv'
    const fp = translationInputFingerprint('x', 'fr')
    await persistTranslationCache(db, docId, fp, 'oui')
    ;(storedRecords[0] as Record<string, unknown>).cacheVersion = 0

    expect(await readCachedTranslation(db, docId, fp)).toBeNull()
  })

  it('readCachedTranslation hits via scan when id map is absent', async () => {
    const db = getEntityDB()
    const docId = 'doc_scan'
    const fp = translationInputFingerprint('solo', 'it')
    await persistTranslationCache(db, docId, fp, 'ciao')
    memoryLocalStorage.removeItem(translateCacheIdsStorageKey(docId))

    expect(await readCachedTranslation(db, docId, fp)).toBe('ciao')
  })

  it('persistSummaryCache + readCachedSummary id and fingerprint round-trip', async () => {
    const db = getEntityDB()
    const docId = 'doc_sum'
    const fp = summaryInputFingerprint('translated body', 'en')
    await persistSummaryCache(db, docId, fp, 'Short summary.')

    const map = JSON.parse(lsStore[translateCacheIdsStorageKey(docId)]!) as {
      summaryId?: number
    }
    expect(map.summaryId).toBe(1)
    expect(await readCachedSummary(db, docId, fp)).toBe('Short summary.')
    expect(await readCachedSummary(db, docId, 'wrong-fp')).toBeNull()
  })

  it('persistSafetyCache + readCachedSafety id and fingerprint round-trip', async () => {
    const db = getEntityDB()
    const docId = 'doc_safe'
    const ocr: OCRResult = {
      documentId: docId,
      fullText: 'notice text',
      blocks: [],
    }
    const fp = safetyInputFingerprint(ocr, null, undefined)
    const payload = minimalSafetyResponse()
    await persistSafetyCache(db, docId, fp, payload)

    const map = JSON.parse(lsStore[translateCacheIdsStorageKey(docId)]!) as {
      safetyId?: number
    }
    expect(map.safetyId).toBe(1)
    const back = await readCachedSafety(db, docId, fp)
    expect(back).toEqual(payload)
    expect(await readCachedSafety(db, docId, 'bad')).toBeNull()
  })
})

describe('translate cache fingerprints', () => {
  it('translationInputFingerprint is stable and changes with text or language', () => {
    const a = translationInputFingerprint('hello', 'es')
    expect(translationInputFingerprint('hello', 'es')).toBe(a)
    expect(translationInputFingerprint('hello', 'fr')).not.toBe(a)
    expect(translationInputFingerprint('hellp', 'es')).not.toBe(a)
  })

  it('summaryInputFingerprint treats undefined outputLanguage like empty string', () => {
    const withEmpty = summaryInputFingerprint('t', '')
    const withUndef = summaryInputFingerprint('t', undefined)
    expect(withEmpty).toBe(withUndef)
  })

  it('safetyInputFingerprint changes when OCR fullText changes', () => {
    const base: OCRResult = {
      documentId: 'd',
      fullText: 'same',
      blocks: [],
    }
    const fp1 = safetyInputFingerprint(base, null)
    const fp2 = safetyInputFingerprint(
      { ...base, fullText: 'changed' },
      null,
    )
    expect(fp1).not.toBe(fp2)
  })
})

describe('resolveRecordDocId', () => {
  it('reads docId or nested document.id', () => {
    expect(resolveRecordDocId({ docId: 'a' })).toBe('a')
    expect(
      resolveRecordDocId({
        document: { id: 'nested' },
      })
    ).toBe('nested')
    expect(resolveRecordDocId({})).toBeUndefined()
  })
})
