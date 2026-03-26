import { describe, it, expect } from 'vitest'
import {
  buildSafetyRecommendationPresentation,
  normalizeConfidence,
  normalizeLegitimacy,
  normalizeRiskLevel,
  selectNextSteps,
} from './safetyRecommendations'
import { normalizeSeverity } from './safetyNextSteps'
import type { SafetyFlags } from '@/types'

describe('normalizeConfidence', () => {
  it('maps 0–1 to 0–100', () => {
    expect(normalizeConfidence(0.85)).toBe(85)
    expect(normalizeConfidence(1)).toBe(100)
  })

  it('accepts 0–100 integers', () => {
    expect(normalizeConfidence(72)).toBe(72)
  })

  it('returns undefined for invalid', () => {
    expect(normalizeConfidence('high')).toBeUndefined()
    expect(normalizeConfidence(NaN)).toBeUndefined()
  })
})

describe('normalizeLegitimacy', () => {
  it('parses common variants', () => {
    expect(normalizeLegitimacy('likely_scam')).toBe('likely_scam')
    expect(normalizeLegitimacy('Likely Scam')).toBe('likely_scam')
    expect(normalizeLegitimacy('likely legitimate')).toBe('likely_legitimate')
  })
})

describe('normalizeRiskLevel', () => {
  it('accepts lowercase severity strings', () => {
    expect(normalizeRiskLevel('high')).toBe('high')
  })

  it('returns undefined for invalid values', () => {
    expect(normalizeRiskLevel('critical')).toBeUndefined()
  })
})

describe('selectNextSteps', () => {
  it('uses general bucket and verify step when confidence is low', () => {
    const steps = selectNextSteps({
      category: 'Medical Bill',
      severity: normalizeSeverity('low'),
      confidence: 30,
      hasExplanation: true,
    })
    expect(steps.some((s) => s.label.includes('official website'))).toBe(true)
    expect(steps.some((s) => s.value?.includes('usa.gov'))).toBe(true)
    expect(steps.some((s) => s.value?.includes('medicare.gov'))).toBe(false)
  })

  it('prepends scam resources when likely_scam', () => {
    const steps = selectNextSteps({
      category: 'Debt Collection Letter',
      severity: 'medium',
      legitimacy: 'likely_scam',
      confidence: 80,
      hasExplanation: true,
    })
    const ic3 = steps.findIndex((s) => s.value?.includes('ic3.gov'))
    const ftc = steps.findIndex((s) => s.value?.includes('reportfraud.ftc.gov'))
    expect(ftc).toBeGreaterThanOrEqual(0)
    expect(ic3).toBeGreaterThanOrEqual(0)
  })

  it('drops IRS phone when scam confidence is high enough', () => {
    const steps = selectNextSteps({
      category: 'IRS Tax Notice',
      severity: 'medium',
      legitimacy: 'likely_scam',
      confidence: 70,
      hasExplanation: true,
    })
    expect(steps.some((s) => s.value?.includes('829-1040'))).toBe(false)
  })

  it('adds missing-explanation hint when hasExplanation is false', () => {
    const steps = selectNextSteps({
      category: 'Bank Statement',
      severity: 'low',
      hasExplanation: false,
    })
    expect(steps[0].label.toLowerCase()).toContain('could not tie')
  })
})

describe('buildSafetyRecommendationPresentation', () => {
  it('builds headline, resources filter, and null summary', () => {
    const flags: SafetyFlags = {
      category: 'Medical Bill',
      severity: 'medium',
      detectedAt: 1,
      nextSteps: [
        { label: 'Read this', type: 'info' },
        { label: 'Help', type: 'url', value: 'https://example.com' },
      ],
    }
    const p = buildSafetyRecommendationPresentation(flags)
    expect(p.headline).toContain('Medical Bill')
    expect(p.summary).toBeNull()
    expect(p.primaryActions).toHaveLength(2)
    expect(p.resources).toHaveLength(1)
    expect(p.disclaimer.length).toBeGreaterThan(10)
  })
})
