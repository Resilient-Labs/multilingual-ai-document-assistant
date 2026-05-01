'use client'

/**
 * Versioned IndexedDB cache for translate flow session payload (mirrors
 * sessionStorage shape) so a tab reload can recover after sessionStorage loss.
 */

import type { EntityDB } from '@babycommando/entity-db'

import { getEntityDB } from '@/lib/entitydb'
import type {
  FieldCandidate,
  OCRResult,
  SafetyAnalysisResponse,
} from '@/types'
import {
  ENTITYDB_VECTORS_STORE,
  TRANSLATE_SESSION_ENTITY_KEY,
  deleteAllVectorsForDocId as deleteAllVectorsForDocIdFromIdb,
  getIdbFrom,
  placeholderEmbeddingVector,
} from '@/lib/entitydb-idb'

/** Bump when the persisted row shape changes so stale rows are ignored. */
export const CACHE_ROW_VERSION = 1 as const

function isCacheVersionValid(r: Record<string, unknown>): boolean {
  return r.cacheVersion === CACHE_ROW_VERSION
}

/** Translation result rows (same vectors store; not used for RAG). */
export const TRANSLATION_CACHE_ENTITY_KEY = 'cached_translation' as const

/** Summarize API result rows (inputs: translated text + output language). */
export const SUMMARY_CACHE_ENTITY_KEY = 'cached_summary' as const

/** Safety API result rows (inputs mirror `analyzeDocumentSafety` request body). */
export const SAFETY_CACHE_ENTITY_KEY = 'cached_safety' as const

export interface TranslateCacheIdMap {
  translationId?: number
  summaryId?: number
  safetyId?: number
}

export function translateCacheIdsStorageKey(docId: string): string {
  return `translate-cache-ids-${docId}`
}

/** Fingerprint of translate API inputs (source text + target language). */
export function translationInputFingerprint(
  fullText: string,
  targetLang: string
): string {
  const str = `${targetLang}\u0000${fullText}`
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

/** Fingerprint for `/api/summarize` inputs (translated body + optional BCP-47). */
export function summaryInputFingerprint(
  translatedFullText: string,
  outputLanguage: string | undefined
): string {
  const lang = outputLanguage ?? ''
  const str = `${lang}\u0000${translatedFullText}`
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

/**
 * Fingerprint for `/api/safety` inputs (same shaping as {@link analyzeDocumentSafety}).
 */
export function safetyInputFingerprint(
  ocr: OCRResult,
  fieldCandidates: FieldCandidate[] | null,
  targetLang?: string
): string {
  const fullText = ocr.fullText?.trim() ?? ''
  const blocks =
    ocr.blocks?.map((b) => ({ text: b.text, confidence: b.confidence })) ?? []
  const slim =
    fieldCandidates
      ?.filter((c) => c?.value?.trim())
      .map(({ key, value, confidence }) => ({ key, value, confidence })) ?? []

  const parts: Record<string, unknown> = {}
  if (fullText) parts.fullText = fullText
  if (!fullText && blocks.length > 0) parts.blocks = blocks
  if (slim.length > 0) parts.fieldCandidates = slim
  const ol = targetLang?.trim()
  if (ol) parts.outputLanguage = ol

  const str = JSON.stringify(parts)
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

function readTranslateCacheIdMap(docId: string): TranslateCacheIdMap {
  if (typeof window === 'undefined' || !docId) return {}
  try {
    const raw = localStorage.getItem(translateCacheIdsStorageKey(docId))
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const map: TranslateCacheIdMap = {}
    if (typeof o.translationId === 'number') map.translationId = o.translationId
    if (typeof o.summaryId === 'number') map.summaryId = o.summaryId
    if (typeof o.safetyId === 'number') map.safetyId = o.safetyId
    return map
  } catch {
    return {}
  }
}

export function mergeTranslateCacheIds(
  docId: string,
  partial: Partial<TranslateCacheIdMap>
): void {
  if (typeof window === 'undefined' || !docId) return
  const key = translateCacheIdsStorageKey(docId)
  const prev = readTranslateCacheIdMap(docId)
  localStorage.setItem(key, JSON.stringify({ ...prev, ...partial }))
}

function isValidTranslationCacheRow(
  r: Record<string, unknown>,
  docId: string,
  fingerprint: string
): r is Record<string, unknown> & { translatedText: string } {
  return (
    r.entityKey === TRANSLATION_CACHE_ENTITY_KEY &&
    r.docId === docId &&
    r.translationFingerprint === fingerprint &&
    isCacheVersionValid(r) &&
    typeof r.translatedText === 'string'
  )
}

function isValidSummaryCacheRow(
  r: Record<string, unknown>,
  docId: string,
  fingerprint: string
): r is Record<string, unknown> & { summaryText: string } {
  return (
    r.entityKey === SUMMARY_CACHE_ENTITY_KEY &&
    r.docId === docId &&
    r.summaryFingerprint === fingerprint &&
    isCacheVersionValid(r) &&
    typeof r.summaryText === 'string'
  )
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isValidSafetyCacheRow(
  r: Record<string, unknown>,
  docId: string,
  fingerprint: string
): r is Record<string, unknown> & SafetyAnalysisResponse {
  if (
    r.entityKey !== SAFETY_CACHE_ENTITY_KEY ||
    r.docId !== docId ||
    r.safetyFingerprint !== fingerprint ||
    !isCacheVersionValid(r) ||
    !isPlainObject(r.flags) ||
    !isPlainObject(r.presentation)
  ) {
    return false
  }
  const f = r.flags
  const p = r.presentation
  if (
    typeof f.category !== 'string' ||
    typeof f.severity !== 'string' ||
    typeof f.detectedAt !== 'number' ||
    typeof p.headline !== 'string' ||
    typeof p.severityLabel !== 'string' ||
    !Array.isArray(p.primaryActions) ||
    !Array.isArray(p.resources) ||
    typeof p.disclaimer !== 'string'
  ) {
    return false
  }
  if (p.summary != null && typeof p.summary !== 'string') {
    return false
  }
  return true
}

/**
 * Prefer `get(translationId)` from localStorage map; validate row; else scan.
 */
export async function readCachedTranslation(
  entityDB: EntityDB,
  docId: string,
  fingerprint: string
): Promise<string | null> {
  if (typeof window === 'undefined' || !docId) {
    return null
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)

  const { translationId } = readTranslateCacheIdMap(docId)
  if (typeof translationId === 'number') {
    const raw = await store.get(translationId)
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>
      if (isValidTranslationCacheRow(r, docId, fingerprint)) {
        return r.translatedText
      }
    }
  }

  const records = await store.getAll()
  const candidates = records.filter((row) =>
    isValidTranslationCacheRow(row as Record<string, unknown>, docId, fingerprint)
  )
  if (candidates.length === 0) return null
  candidates.sort(
    (a, b) =>
      ((b as { cachedAt?: number }).cachedAt ?? 0) -
      ((a as { cachedAt?: number }).cachedAt ?? 0)
  )
  const best = candidates[0] as Record<string, unknown>
  return typeof best.translatedText === 'string' ? best.translatedText : null
}

/**
 * Replace any prior translation cache rows for `docId`, write the new row, and
 * store `translationId` in `translate-cache-ids-${docId}` (D1 hybrid).
 */
export async function persistTranslationCache(
  entityDB: EntityDB,
  docId: string,
  fingerprint: string,
  translatedText: string
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('persistTranslationCache can only run in the browser')
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readwrite')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const records = await store.getAll()
  for (const row of records) {
    const r = row as Record<string, unknown>
    if (
      r.entityKey === TRANSLATION_CACHE_ENTITY_KEY &&
      r.docId === docId &&
      typeof r.id === 'number'
    ) {
      await store.delete(r.id)
    }
  }
  const key = await store.add({
    entityKey: TRANSLATION_CACHE_ENTITY_KEY,
    docId,
    translationFingerprint: fingerprint,
    translatedText,
    text: translatedText.slice(0, 200),
    vector: placeholderEmbeddingVector(),
    cacheVersion: CACHE_ROW_VERSION,
    cachedAt: Date.now(),
  })
  if (typeof key !== 'number') {
    throw new Error('Expected numeric IDB key for translation cache row')
  }
  mergeTranslateCacheIds(docId, { translationId: key })
}

/**
 * Prefer `get(summaryId)` from localStorage map; validate row; else scan.
 */
export async function readCachedSummary(
  entityDB: EntityDB,
  docId: string,
  fingerprint: string
): Promise<string | null> {
  if (typeof window === 'undefined' || !docId) {
    return null
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)

  const { summaryId } = readTranslateCacheIdMap(docId)
  if (typeof summaryId === 'number') {
    const raw = await store.get(summaryId)
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>
      if (isValidSummaryCacheRow(r, docId, fingerprint)) {
        return r.summaryText
      }
    }
  }

  const records = await store.getAll()
  const candidates = records.filter((row) =>
    isValidSummaryCacheRow(row as Record<string, unknown>, docId, fingerprint)
  )
  if (candidates.length === 0) return null
  candidates.sort(
    (a, b) =>
      ((b as { cachedAt?: number }).cachedAt ?? 0) -
      ((a as { cachedAt?: number }).cachedAt ?? 0)
  )
  const best = candidates[0] as Record<string, unknown>
  return typeof best.summaryText === 'string' ? best.summaryText : null
}

/**
 * Replace prior summary cache rows for `docId`, write the new row, and merge
 * `summaryId` into `translate-cache-ids-${docId}` (D1 hybrid).
 */
export async function persistSummaryCache(
  entityDB: EntityDB,
  docId: string,
  fingerprint: string,
  summaryText: string
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('persistSummaryCache can only run in the browser')
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readwrite')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const records = await store.getAll()
  for (const row of records) {
    const r = row as Record<string, unknown>
    if (
      r.entityKey === SUMMARY_CACHE_ENTITY_KEY &&
      r.docId === docId &&
      typeof r.id === 'number'
    ) {
      await store.delete(r.id)
    }
  }
  const key = await store.add({
    entityKey: SUMMARY_CACHE_ENTITY_KEY,
    docId,
    summaryFingerprint: fingerprint,
    summaryText,
    text: summaryText.slice(0, 200),
    vector: placeholderEmbeddingVector(),
    cacheVersion: CACHE_ROW_VERSION,
    cachedAt: Date.now(),
  })
  if (typeof key !== 'number') {
    throw new Error('Expected numeric IDB key for summary cache row')
  }
  mergeTranslateCacheIds(docId, { summaryId: key })
}

/**
 * Prefer `get(safetyId)` from localStorage map; validate row; else scan.
 */
export async function readCachedSafety(
  entityDB: EntityDB,
  docId: string,
  fingerprint: string
): Promise<SafetyAnalysisResponse | null> {
  if (typeof window === 'undefined' || !docId) {
    return null
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)

  const { safetyId } = readTranslateCacheIdMap(docId)
  if (typeof safetyId === 'number') {
    const raw = await store.get(safetyId)
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>
      if (isValidSafetyCacheRow(r, docId, fingerprint)) {
        return { flags: r.flags, presentation: r.presentation }
      }
    }
  }

  const records = await store.getAll()
  const candidates = records.filter((row) =>
    isValidSafetyCacheRow(row as Record<string, unknown>, docId, fingerprint)
  )
  if (candidates.length === 0) return null
  candidates.sort(
    (a, b) =>
      ((b as { cachedAt?: number }).cachedAt ?? 0) -
      ((a as { cachedAt?: number }).cachedAt ?? 0)
  )
  const best = candidates[0] as Record<string, unknown>
  if (!isValidSafetyCacheRow(best, docId, fingerprint)) return null
  return { flags: best.flags, presentation: best.presentation }
}

/**
 * Replace prior safety cache rows for `docId`, write the new row, and merge
 * `safetyId` into `translate-cache-ids-${docId}` (D1 hybrid).
 */
export async function persistSafetyCache(
  entityDB: EntityDB,
  docId: string,
  fingerprint: string,
  response: SafetyAnalysisResponse
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('persistSafetyCache can only run in the browser')
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readwrite')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const records = await store.getAll()
  for (const row of records) {
    const r = row as Record<string, unknown>
    if (
      r.entityKey === SAFETY_CACHE_ENTITY_KEY &&
      r.docId === docId &&
      typeof r.id === 'number'
    ) {
      await store.delete(r.id)
    }
  }
  const label =
    response.presentation.headline?.slice(0, 200) ??
    response.flags.category?.slice(0, 200) ??
    ''
  const key = await store.add({
    entityKey: SAFETY_CACHE_ENTITY_KEY,
    docId,
    safetyFingerprint: fingerprint,
    flags: response.flags,
    presentation: response.presentation,
    text: label,
    vector: placeholderEmbeddingVector(),
    cacheVersion: CACHE_ROW_VERSION,
    cachedAt: Date.now(),
  })
  if (typeof key !== 'number') {
    throw new Error('Expected numeric IDB key for safety cache row')
  }
  mergeTranslateCacheIds(docId, { safetyId: key })
}

export { TRANSLATE_SESSION_ENTITY_KEY }

export interface TranslateSessionFields {
  fullText: string
  filename: string
  sourceLang: string
  targetLang: string
}

function isTranslateSessionFields(
  r: Record<string, unknown>
): r is Record<string, unknown> & TranslateSessionFields {
  return (
    typeof r.fullText === 'string' &&
    typeof r.filename === 'string' &&
    typeof r.sourceLang === 'string' &&
    typeof r.targetLang === 'string'
  )
}

function rowToSession(
  r: Record<string, unknown>
): TranslateSessionFields | null {
  if (!isTranslateSessionFields(r)) return null
  return {
    fullText: r.fullText,
    filename: r.filename,
    sourceLang: r.sourceLang,
    targetLang: r.targetLang,
  }
}

/**
 * Persist translate session fields for `docId`. Returns the IDB primary key.
 */
export async function persistTranslateSessionCache(
  entityDB: EntityDB,
  docId: string,
  session: TranslateSessionFields
): Promise<number> {
  if (typeof window === 'undefined') {
    throw new Error('persistTranslateSessionCache can only run in the browser')
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readwrite')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const key = await store.add({
    entityKey: TRANSLATE_SESSION_ENTITY_KEY,
    text: session.fullText,
    vector: placeholderEmbeddingVector(),
    docId,
    cacheVersion: CACHE_ROW_VERSION,
    cachedAt: Date.now(),
    ...session,
  })
  if (typeof key !== 'number') {
    throw new Error('Expected numeric IDB key for translate session row')
  }
  return key
}

/**
 * Read by IDB key and validate entity key + cache row version + payload shape.
 */
export async function getTranslateSessionByStoredId(
  entityDB: EntityDB,
  storedId: number
): Promise<TranslateSessionFields | null> {
  if (typeof window === 'undefined') {
    return null
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const raw = await store.get(storedId)
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.entityKey !== TRANSLATE_SESSION_ENTITY_KEY) return null
  if (!isCacheVersionValid(r)) return null
  return rowToSession(r)
}

/**
 * Fallback: scan all vectors rows for a valid translate_session for `docId`
 * (latest `cachedAt` wins).
 */
export async function getTranslateSessionByDocId(
  entityDB: EntityDB,
  docId: string
): Promise<TranslateSessionFields | null> {
  if (typeof window === 'undefined' || !docId) {
    return null
  }
  const idb = await getIdbFrom(entityDB)
  const tx = idb.transaction(ENTITYDB_VECTORS_STORE, 'readonly')
  const store = tx.objectStore(ENTITYDB_VECTORS_STORE)
  const records = await store.getAll()

  const candidates = records.filter(
    (r) =>
      r.entityKey === TRANSLATE_SESSION_ENTITY_KEY &&
      r.docId === docId &&
      isCacheVersionValid(r) &&
      rowToSession(r) != null
  )

  if (candidates.length === 0) return null

  candidates.sort(
    (a, b) =>
      ((b.cachedAt as number) ?? 0) - ((a.cachedAt as number) ?? 0)
  )

  return rowToSession(candidates[0]!)
}

/** Same as {@link deleteAllVectorsForDocId} from `entitydb-idb` (D2-B). */
export async function deleteAllVectorsForDocId(
  docId: string
): Promise<void> {
  return deleteAllVectorsForDocIdFromIdb(getEntityDB(), docId)
}
