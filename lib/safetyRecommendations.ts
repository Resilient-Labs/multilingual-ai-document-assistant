/**
 * Team 5: Confidence, legitimacy, and bucket → ordered next steps + UI presentation.
 */

import {
  SAFETY_CONFIDENCE_LOW,
  SAFETY_CONFIDENCE_MIN_FOR_SCAM_RESOURCE_ADJUSTMENT,
} from '@/lib/safetyConstants'
import {
  type SafetyLang,
  SAFETY_DISCLAIMER,
  SAFETY_SERIOUSNESS_LABELS,
  SAFETY_SEVERITY_LABELS,
} from '@/lib/safetyI18n'
import {
  getBucketSteps,
  getMissingExplanationStep,
  getScamPrioritySteps,
  getUrgentPrefix,
  getVerifyOfficialStep,
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

const SEVERITY_RANK: Record<SafetySeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
}

/** Higher of two severity buckets (for merging model severity with scam seriousness floor). */
export function maxSeverity(a: SafetySeverity, b: SafetySeverity): SafetySeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b
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
  /**
   * Time-urgency tier for deadline-style lead-ins. Defaults to `severity`.
   * For likely scams, pass `low` so we do not urge fast “completion” on a fraudulent document.
   */
  urgencyTier?: SafetySeverity
  confidence?: number
  legitimacy?: SafetyLegitimacy
  hasExplanation: boolean
}

export function selectNextSteps(
  input: SelectNextStepsInput,
  lang: SafetyLang = 'en'
): RiskNextStep[] {
  const {
    category,
    severity,
    urgencyTier: urgencyTierInput,
    confidence,
    legitimacy = 'uncertain',
    hasExplanation,
  } = input

  const urgencyTier =
    legitimacy === 'likely_scam'
      ? 'low'
      : (urgencyTierInput ?? severity)

  const lowConfidence =
    confidence !== undefined && confidence < SAFETY_CONFIDENCE_LOW
  const unknownCategory = category.trim().toLowerCase() === 'unknown'

  let bucket: SafetyResourceBucket = normalizeCategoryToBucket(category)
  if (lowConfidence || unknownCategory) {
    bucket = 'general'
  }

  let steps = [...getBucketSteps(bucket, lang)]
  if (legitimacy === 'likely_scam') {
    steps = filterInstitutionPhonesForScam(bucket, steps, confidence)
  }

  const prefix: RiskNextStep[] = []
  if (urgencyTier === 'urgent' || urgencyTier === 'high') {
    prefix.push(getUrgentPrefix(lang))
  }
  if (legitimacy === 'likely_scam') {
    prefix.push(...getScamPrioritySteps(lang))
  }
  if (lowConfidence) {
    prefix.push(getVerifyOfficialStep(lang))
  }
  if (!hasExplanation) {
    prefix.push(getMissingExplanationStep(lang))
  }

  return [...prefix, ...steps]
}

export function buildSafetyRecommendationPresentation(
  flags: SafetyFlags,
  lang: SafetyLang = 'en'
): SafetyRecommendationPresentation {
  const { category, severity, legitimacy, riskLevel, nextSteps } = flags
  const seriousness = riskLevel ?? severity
  const urgencyStyleLabel =
    SAFETY_SEVERITY_LABELS[lang][severity] ??
    SAFETY_SEVERITY_LABELS[lang].medium
  const seriousnessLabel =
    SAFETY_SERIOUSNESS_LABELS[lang][seriousness] ??
    SAFETY_SERIOUSNESS_LABELS[lang].medium

  const isScam = legitimacy === 'likely_scam'
  const severityLabel = isScam ? seriousnessLabel : urgencyStyleLabel
  const headline = `${category} · ${severityLabel}`
  const urgencyLabel = isScam
    ? SAFETY_SEVERITY_LABELS[lang].low
    : null

  const resources = nextSteps.filter(
    (s) => s.type === 'url' || s.type === 'phone'
  )
  return {
    headline,
    severityLabel,
    urgencyLabel,
    summary: null,
    primaryActions: nextSteps,
    resources,
    disclaimer: SAFETY_DISCLAIMER[lang],
  }
}
