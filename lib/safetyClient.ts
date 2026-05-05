/**
 * Team 5: Client helper for safety analysis.
 * Maps Team 1 extract output (OCRResult) to the safety API.
 * Brandi and other consumers can use this or the useSafetyAnalysis hook.
 */

import type {
  FieldCandidate,
  OCRResult,
  SafetyAnalysisRequest,
  SafetyAnalysisResponse,
} from '@/types'

/**
 * Analyze document text for safety/risk flags.
 * Call with ocr from ExtractionResponse (Team 1) after extract completes.
 *
 * @param ocr - OCR result from POST /api/documents/extract (document.ocr)
 * @param fieldCandidates - Optional regex-extracted fields from OCR blocks.
 *   Only `key`, `value`, and `confidence` are forwarded; document-internal ids
 *   are dropped to keep the payload zero-retention-friendly.
 * @returns Safety flags from the analysis model
 * @throws Error if the request fails
 */
export async function analyzeDocumentSafety(
  ocr: OCRResult,
  fieldCandidates: FieldCandidate[] | null = null,
  targetLang?: string
): Promise<SafetyAnalysisResponse> {
  const fullText = ocr.fullText?.trim()
  const blocks =
    ocr.blocks?.map((b) => ({ text: b.text, confidence: b.confidence })) ?? []

  const slim =
    fieldCandidates
      ?.filter((c) => c?.value?.trim())
      .map(({ key, value, confidence }) => ({ key, value, confidence })) ?? []

  const body: SafetyAnalysisRequest = {
    ...(fullText ? { fullText } : {}),
    ...(!fullText && blocks.length > 0 ? { blocks } : {}),
    ...(slim.length > 0 ? { fieldCandidates: slim } : {}),
    ...(targetLang?.trim() ? { outputLanguage: targetLang.trim() } : {}),
  }

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
