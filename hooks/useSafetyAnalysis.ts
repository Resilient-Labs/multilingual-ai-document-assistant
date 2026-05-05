'use client'

import { useState, useEffect } from 'react'
import { analyzeDocumentSafety } from '@/lib/safetyClient'
import {
  persistSafetyCache,
  readCachedSafety,
  safetyInputFingerprint,
} from '@/lib/entitydb-translate-cache'
import { getEntityDB } from '@/lib/entitydb'
import type {
  FieldCandidate,
  OCRResult,
  SafetyFlags,
  SafetyRecommendationPresentation,
} from '@/types'

export interface UseSafetyAnalysisResult {
  flags: SafetyFlags | null
  presentation: SafetyRecommendationPresentation | null
  loading: boolean
  error: string | null
}

/**
 * Hook to run safety analysis when OCR data is available.
 * Brandi and other consumers can use this in the results panel.
 *
 * @param ocr - OCR result from extraction (null to skip analysis)
 * @param fieldCandidates - Regex-extracted fields from OCR blocks, forwarded to the safety API for grounding
 * @param targetLang - User UI language (e.g. translate target); forwarded as outputLanguage for localized safety output
 * @param docId - When set, IndexedDB cache is read first and refreshed rows are persisted after a successful API call
 */
export function useSafetyAnalysis(
  ocr: OCRResult | null,
  fieldCandidates: FieldCandidate[] | null = null,
  targetLang?: string,
  docId?: string
): UseSafetyAnalysisResult {
  const [flags, setFlags] = useState<SafetyFlags | null>(null)
  const [presentation, setPresentation] =
    useState<SafetyRecommendationPresentation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ocr) {
      setFlags(null)
      setPresentation(null)
      setError(null)
      setLoading(false)
      return
    }

    const hasText =
      ocr.fullText?.trim() || ocr.blocks?.some((b) => b.text?.trim())
    if (!hasText) {
      setFlags(null)
      setPresentation(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setFlags(null)
    setPresentation(null)

    const fingerprint = docId
      ? safetyInputFingerprint(ocr, fieldCandidates, targetLang)
      : null

    void (async () => {
      try {
        if (docId && fingerprint !== null) {
          const cached = await readCachedSafety(
            getEntityDB(),
            docId,
            fingerprint
          )
          if (cancelled) return
          if (cached) {
            setFlags(cached.flags)
            setPresentation(cached.presentation)
            setError(null)
            return
          }
        }

        const res = await analyzeDocumentSafety(
          ocr,
          fieldCandidates,
          targetLang
        )
        if (cancelled) return
        setFlags(res.flags)
        setPresentation(res.presentation)
        setError(null)
        if (docId && fingerprint !== null) {
          await persistSafetyCache(getEntityDB(), docId, fingerprint, res)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Safety analysis failed'
          )
          setFlags(null)
          setPresentation(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ocr, fieldCandidates, targetLang, docId])

  return { flags, presentation, loading, error }
}
