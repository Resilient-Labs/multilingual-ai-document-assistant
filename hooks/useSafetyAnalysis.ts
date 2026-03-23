'use client'

import { useState, useEffect } from 'react'
import { analyzeDocumentSafety } from '@/lib/safetyClient'
import type { OCRResult, SafetyFlags } from '@/types'

export interface UseSafetyAnalysisResult {
  flags: SafetyFlags | null
  loading: boolean
  error: string | null
}

/**
 * Hook to run safety analysis when OCR data is available.
 * Brandi and other consumers can use this in the results panel.
 *
 * @param ocr - OCR result from extraction (null to skip analysis)
 */
export function useSafetyAnalysis(
  ocr: OCRResult | null
): UseSafetyAnalysisResult {
  const [flags, setFlags] = useState<SafetyFlags | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ocr) {
      setFlags(null)
      setError(null)
      setLoading(false)
      return
    }

    const hasText =
      ocr.fullText?.trim() || ocr.blocks?.some((b) => b.text?.trim())
    if (!hasText) {
      setFlags(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setFlags(null)

    analyzeDocumentSafety(ocr)
      .then((res) => {
        if (!cancelled) {
          setFlags(res.flags)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Safety analysis failed'
          )
          setFlags(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ocr])

  return { flags, loading, error }
}
