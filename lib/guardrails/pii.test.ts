/**
 * Unit tests for the PII detector and the route-level policies that use it.
 *
 * Every active production route currently uses the same DETECT-ONLY policy:
 * `detectPii` runs for observability (logged through `logWarn`), but the
 * request always continues to the upstream provider. The translate and TTS
 * route policies are asserted end-to-end through their composite guardrail
 * helpers, the same ones the route handlers call in production.
 *
 * `checkInputPii` (strict block-on-detect) has no production callers but is
 * tested as a unit because it remains exported as a primitive for future
 * fail-closed deployments.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { detectPii, checkInputPii } from './pii'
import { runTranslateGuardrails, runTtsGuardrails } from './index'

describe('detectPii — passport (labelled)', () => {
  it('flags passport numbers with an explicit label', () => {
    const matches = detectPii('Passport: AB1234567 issued 2020.')
    expect(matches.map((m) => m.type)).toContain('passport')
  })

  it('flags "passport no." style', () => {
    expect(
      detectPii('Passport No. US12345678').map((m) => m.type)
    ).toContain('passport')
  })

  it('flags "ppt" abbreviation', () => {
    expect(detectPii('PPT: A1234567').map((m) => m.type)).toContain('passport')
  })

  it('does NOT flag bare alphanumeric codes that look like passport IDs', () => {
    // These are real-world false positives the old regex
    // (/\b[A-Z]{1,2}\d{6,9}\b/) blew up on. None should match now.
    const samples = [
      'Order reference AB1234567 was shipped on Monday.',
      'Model number US12345678 is in stock.',
      'Tracking ID: A123456789 (carrier internal).',
      'See document P987654 for details.',
      'Part XY12345678 ships next week.',
    ]
    for (const sample of samples) {
      const types = detectPii(sample).map((m) => m.type)
      expect(types).not.toContain('passport')
    }
  })

  it('does NOT flag the word "passport" without an ID', () => {
    expect(
      detectPii('Bring your passport to the appointment.').map((m) => m.type)
    ).not.toContain('passport')
  })
})

describe('detectPii — other registry rules (smoke)', () => {
  it('flags formatted SSN', () => {
    expect(detectPii('SSN: 123-45-6789').map((m) => m.type)).toContain('ssn')
  })

  it('flags credit card numbers', () => {
    expect(
      detectPii('Card 4111 1111 1111 1111 expires 12/30').map((m) => m.type)
    ).toContain('credit_card')
  })

  it('flags phone numbers', () => {
    expect(
      detectPii('Call (555) 123-4567 to confirm.').map((m) => m.type)
    ).toContain('phone')
  })

  it('flags email addresses', () => {
    expect(
      detectPii('Reach me at jane.doe@example.com.').map((m) => m.type)
    ).toContain('email')
  })

  it('flags labelled credentials', () => {
    expect(detectPii('api_key=sk_live_abcd1234').map((m) => m.type)).toContain(
      'credential'
    )
  })

  it('flags labelled bank accounts', () => {
    expect(
      detectPii('Routing number: 021000021').map((m) => m.type)
    ).toContain('bank_account')
  })

  it('flags labelled drivers licenses', () => {
    expect(
      detectPii("Driver's License No. D1234567").map((m) => m.type)
    ).toContain('drivers_license')
  })

  it('returns an empty array for plain prose with no PII', () => {
    expect(detectPii('The quick brown fox jumps over the lazy dog.')).toEqual(
      []
    )
  })
})

describe('checkInputPii — strict block-on-detect primitive (no current callers)', () => {
  // No production route uses this — kept as a primitive for future
  // fail-closed deployments. Locked in as a unit so the shape is stable.
  const ANY_ROUTE = '/api/example'

  it('returns ok=true for clean text', () => {
    const result = checkInputPii('Hello world.', ANY_ROUTE)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('Hello world.')
  })

  it('returns a 422 PII_DETECTED response when PII is present', () => {
    const result = checkInputPii('Email: a@b.co', ANY_ROUTE)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(422)
      expect(result.response.code).toBe('PII_DETECTED')
      expect(result.response.layer).toBe('input-validation')
      expect(result.response.details).toMatchObject({ route: ANY_ROUTE })
    }
  })

  it('does not block bare alphanumeric codes that previously triggered passport false positives', () => {
    const result = checkInputPii(
      'Synthesize this: model AB1234567 (manufactured in 2024).',
      ANY_ROUTE
    )
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// /api/translate route policy: detect-only
// ---------------------------------------------------------------------------

describe('runTranslateGuardrails — translate route policy (detect-only PII)', () => {
  // The translate route exists for users whose documents WILL contain
  // sensitive data: immigration paperwork, court forms, benefits letters,
  // medical bills. PII is detected for observability but never blocks.

  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Silence + capture the structured `logWarn` output (writes to
    // console.warn as a single JSON line — see lib/guardrails/logger.ts).
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  function getWarnLines(): Array<Record<string, unknown>> {
    return consoleWarnSpy.mock.calls.map((args) => {
      const first = args[0]
      try {
        return typeof first === 'string'
          ? (JSON.parse(first) as Record<string, unknown>)
          : {}
      } catch {
        return {}
      }
    })
  }

  it('passes a document containing an SSN through to upstream', () => {
    const result = runTranslateGuardrails(
      { text: 'Applicant SSN: 123-45-6789. Please translate.', targetLang: 'es' },
      '/api/translate'
    )
    expect(result.ok).toBe(true)
  })

  it('passes a document containing a credit card number through to upstream', () => {
    const result = runTranslateGuardrails(
      { text: 'Charge card 4111 1111 1111 1111 for the order.', targetLang: 'es' },
      '/api/translate'
    )
    expect(result.ok).toBe(true)
  })

  it('passes a document containing labelled credentials through to upstream', () => {
    const result = runTranslateGuardrails(
      { text: 'Service login — password: hunter2hunter2', targetLang: 'es' },
      '/api/translate'
    )
    expect(result.ok).toBe(true)
  })

  it('passes a realistic letterhead with phone + email through to upstream', () => {
    const text = [
      'Resilient Coders Community Center',
      '123 Main St., Boston, MA 02118',
      'Tel: (617) 555-0142 · Email: info@resilientcoders.org',
      '',
      'Please bring this form with you to your next visit.',
    ].join('\n')
    const result = runTranslateGuardrails(
      { text, targetLang: 'es' },
      '/api/translate'
    )
    expect(result.ok).toBe(true)
  })

  it('logs detected PII as a structured warning (categories only, no raw text)', () => {
    const result = runTranslateGuardrails(
      {
        text: 'Applicant SSN: 123-45-6789. Email: applicant@example.org.',
        targetLang: 'es',
      },
      '/api/translate'
    )
    expect(result.ok).toBe(true)

    const warns = getWarnLines()
    const piiWarn = warns.find(
      (w) => w.layer === 'input-validation' && w.action === 'warn'
    )
    expect(piiWarn).toBeDefined()
    expect(piiWarn?.route).toBe('/api/translate')

    const meta = piiWarn?.meta as { detectedTypes?: string[] } | undefined
    expect(meta?.detectedTypes).toEqual(
      expect.arrayContaining(['ssn', 'email'])
    )

    // CRITICAL: no field of any logged event should contain the raw user
    // text (the SSN value, the email value, etc.).
    const serialized = JSON.stringify(warns)
    expect(serialized).not.toContain('123-45-6789')
    expect(serialized).not.toContain('applicant@example.org')
  })

  it('does not emit a PII warning when the document contains no PII', () => {
    const result = runTranslateGuardrails(
      {
        text: 'Please translate this paragraph for me. Thank you.',
        targetLang: 'es',
      },
      '/api/translate'
    )
    expect(result.ok).toBe(true)

    const warns = getWarnLines()
    const piiWarn = warns.find(
      (w) => w.layer === 'input-validation' && w.action === 'warn'
    )
    expect(piiWarn).toBeUndefined()
  })

  it('still rejects truly invalid input (e.g. unsupported targetLang)', () => {
    // PII being detect-only must not weaken the OTHER guardrail layers —
    // schema validation, language whitelist, prompt injection, etc.
    const result = runTranslateGuardrails(
      { text: 'Hello', targetLang: 'xx-NOT-A-LANG' },
      '/api/translate'
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// /api/tts route policy: detect-only (Read Aloud)
// ---------------------------------------------------------------------------

describe('runTtsGuardrails — TTS route policy (detect-only PII)', () => {
  // The TTS route ("Read Aloud") exists for users listening to documents
  // they already own and are the only person who needs to hear. Same
  // detect-only treatment as translate / summarize.

  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  function getWarnLines(): Array<Record<string, unknown>> {
    return consoleWarnSpy.mock.calls.map((args) => {
      const first = args[0]
      try {
        return typeof first === 'string'
          ? (JSON.parse(first) as Record<string, unknown>)
          : {}
      } catch {
        return {}
      }
    })
  }

  it('passes a Spanish read-aloud request containing PII through to upstream', () => {
    const result = runTtsGuardrails(
      {
        text: 'Llame al (555) 123-4567 o escriba a info@example.org. SSN: 123-45-6789.',
        targetLang: 'es',
        gender: 'feminine',
      },
      '/api/tts'
    )
    expect(result.ok).toBe(true)
  })

  it('passes an English read-aloud request containing PII through to upstream', () => {
    const result = runTtsGuardrails(
      {
        text: 'Your case number is 123-45-6789. Email follow-up to caseworker@example.org.',
        targetLang: 'en',
        gender: 'masculine',
      },
      '/api/tts'
    )
    expect(result.ok).toBe(true)
  })

  it('logs detected PII as a structured warning (categories only, no raw text)', () => {
    const result = runTtsGuardrails(
      {
        text: 'Read aloud — SSN: 123-45-6789. Email: applicant@example.org.',
        targetLang: 'es',
        gender: 'feminine',
      },
      '/api/tts'
    )
    expect(result.ok).toBe(true)

    const warns = getWarnLines()
    const piiWarn = warns.find(
      (w) =>
        w.route === '/api/tts' &&
        w.layer === 'input-validation' &&
        w.action === 'warn'
    )
    expect(piiWarn).toBeDefined()

    const meta = piiWarn?.meta as { detectedTypes?: string[] } | undefined
    expect(meta?.detectedTypes).toEqual(
      expect.arrayContaining(['ssn', 'email'])
    )

    // CRITICAL: no raw user values may appear anywhere in log output.
    const serialized = JSON.stringify(warns)
    expect(serialized).not.toContain('123-45-6789')
    expect(serialized).not.toContain('applicant@example.org')
  })

  it('still rejects truly invalid input (e.g. unsupported gender)', () => {
    const result = runTtsGuardrails(
      { text: 'Hello', targetLang: 'en', gender: 'robot' },
      '/api/tts'
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(422)
  })
})
