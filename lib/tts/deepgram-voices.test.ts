import { describe, expect, it } from 'vitest'
import { getTtsProvider } from '@/lib/tts/router'
import { resolveAuraModel } from '@/lib/tts/deepgram-voices'

describe('resolveAuraModel', () => {
  it('returns mapped Deepgram model for non-Spanish languages', () => {
    expect(resolveAuraModel('en', 'masculine')).toBe('aura-2-apollo-en')
    expect(resolveAuraModel('fr', 'feminine')).toBe('aura-2-agathe-fr')
  })

  it('returns accent-specific model for Spanish', () => {
    expect(resolveAuraModel('es', 'masculine', 'mexican')).toBe(
      'aura-2-javier-es'
    )
    expect(resolveAuraModel('es', 'feminine', 'peninsular')).toBe(
      'aura-2-carina-es'
    )
  })

  it('falls back to latin-american masculine voice where needed', () => {
    expect(resolveAuraModel('es', 'masculine', 'argentine')).toBe(
      'aura-2-aquila-es'
    )
    expect(resolveAuraModel('es', 'masculine', 'colombian')).toBe(
      'aura-2-aquila-es'
    )
  })
})

describe('getTtsProvider', () => {
  it('routes Deepgram-supported languages to Deepgram', () => {
    expect(getTtsProvider('en')).toBe('deepgram')
    expect(getTtsProvider('es')).toBe('deepgram')
    expect(getTtsProvider('ja')).toBe('deepgram')
  })

  it('routes non-Deepgram languages to XTTS by default', () => {
    expect(getTtsProvider('zh')).toBe('xtts')
    expect(getTtsProvider('pl')).toBe('xtts')
    expect(getTtsProvider('ko')).toBe('xtts')
  })

  it('routes sv and vi to MiniMax preferred path', () => {
    expect(getTtsProvider('sv')).toBe('minimax')
    expect(getTtsProvider('vi')).toBe('minimax')
  })
})
