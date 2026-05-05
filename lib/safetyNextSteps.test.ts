import { describe, it, expect } from 'vitest'
import {
  getNextSteps,
  normalizeCategoryToBucket,
  normalizeSeverity,
} from './safetyNextSteps'

describe('normalizeSeverity', () => {
  it('accepts valid severities case-insensitively', () => {
    expect(normalizeSeverity('HIGH')).toBe('high')
    expect(normalizeSeverity(' Urgent ')).toBe('urgent')
  })

  it('defaults invalid values to low', () => {
    expect(normalizeSeverity('critical')).toBe('low')
    expect(normalizeSeverity(1)).toBe('low')
    expect(normalizeSeverity(null)).toBe('low')
  })
})

describe('normalizeCategoryToBucket', () => {
  it('maps prompt document types to buckets', () => {
    expect(normalizeCategoryToBucket('Medical Bill')).toBe('medical')
    expect(normalizeCategoryToBucket('Lease Agreement')).toBe('housing')
    expect(normalizeCategoryToBucket('Court Summons')).toBe('legal')
    expect(normalizeCategoryToBucket('Debt Collection Letter')).toBe(
      'financial'
    )
    expect(normalizeCategoryToBucket('Unknown')).toBe('general')
  })
})

describe('getNextSteps', () => {
  it('returns medical templates for medium severity without urgent lead-in', () => {
    const steps = getNextSteps('Medical Bill', 'medium')
    expect(steps.length).toBe(2)
    expect(
      steps.some((s) => s.type === 'url' && s.value?.includes('medicare'))
    ).toBe(true)
  })

  it('prepends urgency guidance for high and urgent', () => {
    const high = getNextSteps('Bank Statement', 'high')
    const urgent = getNextSteps('Bank Statement', 'urgent')
    expect(high.length).toBe(urgent.length)
    expect(high[0].type).toBe('info')
    expect(high[0].label.toLowerCase()).toContain('deadline')
  })

  it('returns the same structure for Spanish as English', () => {
    const en = getNextSteps('Medical Bill', 'medium', 'en')
    const es = getNextSteps('Medical Bill', 'medium', 'es')
    expect(es.length).toBe(en.length)
  })
})
