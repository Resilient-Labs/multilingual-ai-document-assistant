/**
 * Team 5: Deterministic category/severity → next steps (curated resources).
 * Used by POST /api/safety; safe to import client-side for offline replay.
 */

import { selectNextSteps } from '@/lib/safetyRecommendations'
import type { RiskNextStep, SafetyResourceBucket, SafetySeverity } from '@/types'

export type { SafetyResourceBucket } from '@/types'
export { normalizeCategoryToBucket } from '@/lib/safetyRecommendations'

export function normalizeSeverity(raw: unknown): SafetySeverity {
  if (typeof raw !== 'string') return 'low'
  const s = raw.trim().toLowerCase()
  if (s === 'low' || s === 'medium' || s === 'high' || s === 'urgent') return s
  return 'low'
}

export function getNextSteps(
  category: string,
  severity: SafetySeverity
): RiskNextStep[] {
  return selectNextSteps({
    category,
    severity,
    hasExplanation: true,
  })
}
