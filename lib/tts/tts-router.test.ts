import { describe, expect, it } from 'vitest'
import { getTtsProvider } from '@/lib/tts/router'

describe('getTtsProvider', () => {
  it('always returns hf-space', () => {
    expect(getTtsProvider('en')).toBe('hf-space')
    expect(getTtsProvider('es')).toBe('hf-space')
    expect(getTtsProvider('vi')).toBe('hf-space')
    expect(getTtsProvider('fr')).toBe('hf-space')
    expect(getTtsProvider('auto')).toBe('hf-space')
  })
})
