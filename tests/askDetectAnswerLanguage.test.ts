import { describe, expect, it } from 'vitest'
import {
  detectAnswerLanguage,
  looksLikeEnglishQuestion,
} from '@/lib/askDetectAnswerLanguage'

describe('looksLikeEnglishQuestion', () => {
  it('treats common “english” typos as English (language-switch attempts)', () => {
    expect(looksLikeEnglishQuestion('englsih')).toBe(true)
    expect(looksLikeEnglishQuestion('English please')).toBe(true)
  })
})

describe('detectAnswerLanguage', () => {
  it('treats Latin-American / casual Spanish farewells as Spanish', () => {
    expect(detectAnswerLanguage('chao', 'en', undefined)).toBe('es')
    expect(detectAnswerLanguage('Chau!', 'en', undefined)).toBe('es')
    expect(detectAnswerLanguage('vale gracias', 'en', undefined)).toBe('es')
  })

  it('still classifies clear English questions as English', () => {
    expect(
      detectAnswerLanguage(
        'What documents do I need?',
        'es',
        undefined,
      ),
    ).toBe('en')
  })

  it('uses Spanish translate target when question has no ES/VI markers (parity with VI branch)', () => {
    expect(
      detectAnswerLanguage(
        'anything without clear language markers here',
        'en',
        'es',
      ),
    ).toBe('es')
  })

  it('classifies Vietnamese rights question as VI, not ES (ó in “có” is not Spanish-only)', () => {
    expect(
      detectAnswerLanguage(
        'Tôi có những quyền gì theo thỏa thuận này?',
        'en',
        'es',
      ),
    ).toBe('vi')
  })
})
