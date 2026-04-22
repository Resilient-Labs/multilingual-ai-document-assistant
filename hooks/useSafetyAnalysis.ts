'use client'

import { useState, useEffect } from 'react'
import { analyzeDocumentSafety } from '@/lib/safetyClient'
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
 */
export function useSafetyAnalysis(
  ocr: OCRResult | null,
  fieldCandidates: FieldCandidate[] | null = null
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

    analyzeDocumentSafety(ocr, fieldCandidates)
      .then((res) => {
        if (!cancelled) {
          setFlags(res.flags)
          setPresentation(res.presentation)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Safety analysis failed'
          )
          setFlags(null)
          setPresentation(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ocr, fieldCandidates])

  return { flags, presentation, loading, error }
}
