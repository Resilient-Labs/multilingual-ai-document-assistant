/**
 * Team 5: Client helper for safety analysis.
 * Maps Team 1 extract output (OCRResult) to the safety API.
 * Brandi and other consumers can use this or the useSafetyAnalysis hook.
 */

import type { OCRResult, SafetyAnalysisResponse } from '@/types'

/**
 * Analyze document text for safety/risk flags.
 * Call with ocr from ExtractionResponse (Team 1) after extract completes.
 *
 * @param ocr - OCR result from POST /api/documents/extract (document.ocr)
 * @returns Safety flags from the analysis model
 * @throws Error if the request fails
 */
export async function analyzeDocumentSafety(
  ocr: OCRResult
): Promise<SafetyAnalysisResponse> {
  const fullText = ocr.fullText?.trim()
  const blocks =
    ocr.blocks?.map((b) => ({ text: b.text, confidence: b.confidence })) ?? []

  const body: {
    fullText?: string
    blocks?: Array<{ text: string; confidence?: number }>
  } = fullText ? { fullText } : blocks.length > 0 ? { blocks } : {}

  if (!body.fullText && !body.blocks?.length) {
    throw new Error('OCR has no text to analyze')
  }

  const res = await fetch('/api/safety', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errBody.error ?? `Safety analysis failed (${res.status})`)
  }

  return res.json() as Promise<SafetyAnalysisResponse>
}
