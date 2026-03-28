/**
 * Team 5: Confidence, legitimacy, and bucket → ordered next steps + UI presentation.
 */

import {
  SAFETY_CONFIDENCE_LOW,
  SAFETY_CONFIDENCE_MIN_FOR_SCAM_RESOURCE_ADJUSTMENT,
} from '@/lib/safetyConstants'
import {
  SAFETY_MISSING_EXPLANATION,
  SAFETY_SCAM_PRIORITY_STEPS,
  SAFETY_URGENT_PREFIX,
  SAFETY_VERIFY_OFFICIAL,
  getBucketSteps,
} from '@/lib/safetyResourceBank'
import type {
  RiskNextStep,
  SafetyFlags,
  SafetyLegitimacy,
  SafetyRecommendationPresentation,
  SafetyResourceBucket,
  SafetySeverity,
} from '@/types'

/** Normalize model category string to a coarse bucket for templates. */
export function normalizeCategoryToBucket(
  category: string
): SafetyResourceBucket {
  const c = category.trim().toLowerCase()
  if (
    c.includes('lease') ||
    c.includes('rental') ||
    c.includes('tenant') ||
    c.includes('eviction')
  ) {
    return 'housing'
  }
  if (
    c.includes('medical') ||
    c.includes('health') ||
    c.includes('hospital') ||
    c.includes('eob') ||
    c.includes('medicare')
  ) {
    return 'medical'
  }
  if (
    c.includes('court') ||
    c.includes('summons') ||
    c.includes('subpoena') ||
    c.includes('legal notice')
  ) {
    return 'legal'
  }
  if (
    c.includes('irs') ||
    c.includes('tax') ||
    c.includes('debt') ||
    c.includes('collection') ||
    c.includes('bank') ||
    c.includes('utility') ||
    c.includes('insurance') ||
    c.includes('financial')
  ) {
    return 'financial'
  }
  return 'general'
}

export function normalizeConfidence(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  if (raw >= 0 && raw <= 1) return Math.round(raw * 100)
  if (raw >= 0 && raw <= 100) return Math.round(raw)
  return undefined
}

export function normalizeLegitimacy(raw: unknown): SafetyLegitimacy {
  if (typeof raw !== 'string') return 'uncertain'
  const s = raw.trim().toLowerCase().replace(/\s+/g, '_')
  if (s === 'likely_legitimate' || s === 'legitimate')
    return 'likely_legitimate'
  if (s === 'likely_scam' || s === 'scam' || s === 'likely_fraud')
    return 'likely_scam'
  return 'uncertain'
}

export function normalizeRiskLevel(raw: unknown): SafetySeverity | undefined {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim().toLowerCase()
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'urgent') {
    return v
  }
  return undefined
}

function severityLabel(severity: SafetySeverity): string {
  switch (severity) {
    case 'low':
      return 'Low urgency'
    case 'medium':
      return 'Medium attention'
    case 'high':
      return 'High — review soon'
    case 'urgent':
      return 'Urgent — act quickly'
    default:
      return 'Medium attention'
  }
}

function filterInstitutionPhonesForScam(
  bucket: SafetyResourceBucket,
  steps: RiskNextStep[],
  confidence: number | undefined
): RiskNextStep[] {
  if (bucket !== 'financial') return steps
  const c = confidence ?? 0
  if (c < SAFETY_CONFIDENCE_MIN_FOR_SCAM_RESOURCE_ADJUSTMENT) return steps
  return steps.filter(
    (s) =>
      !(
        s.type === 'phone' &&
        (s.value?.includes('829') || /irs/i.test(s.label))
      )
  )
}

export interface SelectNextStepsInput {
  category: string
  severity: SafetySeverity
  confidence?: number
  legitimacy?: SafetyLegitimacy
  hasExplanation: boolean
}

export function selectNextSteps(input: SelectNextStepsInput): RiskNextStep[] {
  const {
    category,
    severity,
    confidence,
    legitimacy = 'uncertain',
    hasExplanation,
  } = input

  const lowConfidence =
    confidence !== undefined && confidence < SAFETY_CONFIDENCE_LOW
  const unknownCategory = category.trim().toLowerCase() === 'unknown'

  let bucket: SafetyResourceBucket = normalizeCategoryToBucket(category)
  if (lowConfidence || unknownCategory) {
    bucket = 'general'
  }

  let steps = [...getBucketSteps(bucket)]
  if (legitimacy === 'likely_scam') {
    steps = filterInstitutionPhonesForScam(bucket, steps, confidence)
  }

  const prefix: RiskNextStep[] = []
  if (severity === 'urgent' || severity === 'high') {
    prefix.push(SAFETY_URGENT_PREFIX)
  }
  if (legitimacy === 'likely_scam') {
    prefix.push(...SAFETY_SCAM_PRIORITY_STEPS)
  }
  if (lowConfidence) {
    prefix.push(SAFETY_VERIFY_OFFICIAL)
  }
  if (!hasExplanation) {
    prefix.push(SAFETY_MISSING_EXPLANATION)
  }

  return [...prefix, ...steps]
}

const PRESENTATION_DISCLAIMER =
  'This information is for education only. It is not legal, medical, or financial advice.'

export function buildSafetyRecommendationPresentation(
  flags: SafetyFlags
): SafetyRecommendationPresentation {
  const { category, severity, nextSteps } = flags
  const headline = `${category} · ${severityLabel(severity)}`
  const resources = nextSteps.filter(
    (s) => s.type === 'url' || s.type === 'phone'
  )
  return {
    headline,
    severityLabel: severityLabel(severity),
    summary: null,
    primaryActions: nextSteps,
    resources,
    disclaimer: PRESENTATION_DISCLAIMER,
  }
}
