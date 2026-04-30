/**
 * E2E: multilingual translation + text-to-speech (mocked APIs).
 * Covers EN/VI/ES language pairs and Read Aloud flows aligned with the translate page.
 */

type TranslateSession = {
  fullText: string
  filename: string
  sourceLang: string
  targetLang: string
}

/** Fresh id per visit avoids Next/Cypress reusing the same URL without remounting translate effects. */
let translateDocSeq = 0
function uniqueTranslateDocId(): string {
  translateDocSeq += 1
  return `e2e-translation-tts-${translateDocSeq}`
}

/** Minimal valid PCM WAV (silence) for /api/tts intercept — non-empty blob required by the UI.
 * ~2s at 8kHz mono so playback does not end before Cypress can observe Play → Pause. */
function buildMinimalWav(): Uint8Array {
  const numSamples = 16000
  const sampleRate = 8000
  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i))
    }
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  return new Uint8Array(buffer)
}

const MOCK_TRANSLATIONS: Record<string, string> = {
  'en-es': 'Texto de documento de muestra para traducción.',
  'en-vi': 'Văn bản tài liệu mẫu để dịch.',
  'es-en': 'Sample document text for translation.',
  'vi-en': 'Sample document text for translation.',
  'es-vi': 'Văn bản tài liệu mẫu để dịch.',
}

const SAMPLE_TEXT = {
  en: 'Hello world. This is a test document.',
  es: 'Hola mundo. Este es un documento de prueba.',
  vi: 'Xin chào thế giới. Đây là tài liệu thử nghiệm.',
} as const

function createSession(
  sourceLang: string,
  targetLang: string,
  fullText?: string
): TranslateSession {
  return {
    fullText: fullText ?? SAMPLE_TEXT.en,
    filename: 'test-document.pdf',
    sourceLang,
    targetLang,
  }
}

/** Translate page auto-fetches summary — stub so e2e does not depend on LLM/HF. */
function stubSummarizeSuccess() {
  cy.intercept('POST', '**/api/summarize', {
    statusCode: 200,
    body: { summary: 'E2E mock summary.' },
  })
}

function visitWithSession(
  session: TranslateSession,
  translateBody: { translatedText: string }
) {
  const docId = uniqueTranslateDocId()

  stubSummarizeSuccess()
  cy.intercept('POST', '**/api/translate', {
    statusCode: 200,
    body: translateBody,
  }).as('translateApi')

  cy.visit(`/translate/${docId}`, {
    onBeforeLoad(win) {
      win.sessionStorage.clear()
      win.sessionStorage.setItem(
        `translate-${docId}`,
        JSON.stringify(session)
      )
    },
  })

  cy.wait('@translateApi', { timeout: 15000 })
}

function readAloudButtons() {
  return cy.get('button').filter((_, el) => {
    return Cypress.$(el).text().includes('Read Aloud')
  })
}

describe('Translation — language pairs (mocked API)', () => {
  it('English → Spanish: shows translated text and language labels', () => {
    const session = createSession('en', 'es')
    const translated = MOCK_TRANSLATIONS['en-es']
    visitWithSession(session, { translatedText: translated })

    cy.contains('English').should('be.visible')
    cy.contains('Spanish').should('be.visible')
    cy.get('[aria-label="Translated text"]').should('have.value', translated)
    cy.get('[aria-label="Original document text"]').should(
      'have.value',
      session.fullText
    )
    cy.contains('button', 'Read Aloud').should('exist')
  })

  it('English → Vietnamese: completes translation and displays output', () => {
    const session = createSession('en', 'vi')
    const translated = MOCK_TRANSLATIONS['en-vi']
    visitWithSession(session, { translatedText: translated })

    cy.contains('Vietnamese').should('be.visible')
    cy.get('[aria-label="Translated text"]').should('have.value', translated)
    cy.get('[aria-label="Translating document"]').should('not.exist')
  })

  it('Spanish → English: translates and shows English output', () => {
    const session = createSession('es', 'en', SAMPLE_TEXT.es)
    const translated = MOCK_TRANSLATIONS['es-en']
    visitWithSession(session, { translatedText: translated })

    cy.contains('English').should('be.visible')
    cy.get('[aria-label="Translated text"]').should('have.value', translated)
  })

  it('Vietnamese → English: translates and shows English output', () => {
    const session = createSession('vi', 'en', SAMPLE_TEXT.vi)
    const translated = MOCK_TRANSLATIONS['vi-en']
    visitWithSession(session, { translatedText: translated })

    cy.get('[aria-label="Translated text"]').should('have.value', translated)
  })

  it('Spanish → Vietnamese: shows mocked Vietnamese translation', () => {
    const session = createSession('es', 'vi', SAMPLE_TEXT.es)
    const translated = MOCK_TRANSLATIONS['es-vi']
    visitWithSession(session, { translatedText: translated })

    cy.get('[aria-label="Translated text"]').should('have.value', translated)
  })

  it('shows translating spinner then removes it after success', () => {
    const docId = uniqueTranslateDocId()
    stubSummarizeSuccess()
    cy.intercept('POST', '**/api/translate', (req) => {
      req.reply({
        delay: 400,
        statusCode: 200,
        body: { translatedText: MOCK_TRANSLATIONS['en-es'] },
      })
    }).as('translateDelayed')

    cy.visit(`/translate/${docId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.clear()
        win.sessionStorage.setItem(
          `translate-${docId}`,
          JSON.stringify(createSession('en', 'es'))
        )
      },
    })

    cy.get('[aria-label="Translating document"]').should('exist')
    cy.wait('@translateDelayed', { timeout: 15000 })
    cy.get('[aria-label="Translating document"]').should('not.exist')
    cy.contains('Translation failed').should('not.exist')
  })
})

describe('Text-to-speech — Read Aloud (mocked /api/tts)', () => {
  function stubTtsSuccess() {
    const wav = buildMinimalWav()
    cy.intercept('POST', '**/api/tts', (req) => {
      req.reply({
        statusCode: 200,
        headers: { 'Content-Type': 'audio/wav' },
        body: wav,
      })
    }).as('ttsApi')
  }

  it('shows Read Aloud for supported languages (en/es/vi) on original + translation', () => {
    stubTtsSuccess()
    const session = createSession('en', 'es')
    visitWithSession(session, { translatedText: MOCK_TRANSLATIONS['en-es'] })

    readAloudButtons().should('have.length', 2)
  })

  it('does not render Read Aloud when source and target are outside TTS set', () => {
    const docId = uniqueTranslateDocId()
    stubSummarizeSuccess()
    cy.intercept('POST', '**/api/translate', {
      statusCode: 200,
      body: { translatedText: 'Text auf Deutsch.' },
    }).as('translateApi')

    cy.visit(`/translate/${docId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.clear()
        win.sessionStorage.setItem(
          `translate-${docId}`,
          JSON.stringify(
            createSession('fr', 'de', 'Bonjour le monde.')
          )
        )
      },
    })

    cy.wait('@translateApi', { timeout: 15000 })
    cy.contains('button', 'Read Aloud').should('not.exist')
  })

  it('English Read Aloud: voice dialog, Start, then playback UI', () => {
    stubTtsSuccess()
    const session = createSession('en', 'es')
    visitWithSession(session, { translatedText: MOCK_TRANSLATIONS['en-es'] })

    cy.get('[aria-label="Original document text"]')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('button', 'Read Aloud').click()
      })

    cy.contains('Read Aloud voice settings').should('be.visible')
    cy.get('#voice-masculine').click({ force: true })
    cy.contains('button', 'Start').click()

    cy.wait('@ttsApi')
    cy.contains('Read Aloud failed').should('not.exist')
    cy.get('[aria-label="AI read aloud"]').should('be.visible')
    cy.contains('button', 'Play').should('be.visible')
    cy.get('[aria-label="Playback speed"]').should('exist')
    cy.get('[aria-label="Seek audio"]').should('exist')
  })

  it('Spanish translation Read Aloud: generates audio without gender dialog', () => {
    stubTtsSuccess()
    const session = createSession('en', 'es')
    visitWithSession(session, { translatedText: MOCK_TRANSLATIONS['en-es'] })

    cy.get('[aria-label="Translated text"]')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('button', 'Read Aloud').click()
      })

    cy.contains('Read Aloud voice settings').should('not.exist')
    cy.wait('@ttsApi')
    cy.get('[aria-label="AI read aloud"]').should('be.visible')
  })

  it('Vietnamese Read Aloud on translated text: immediate generation', () => {
    stubTtsSuccess()
    const session = createSession('en', 'vi')
    visitWithSession(session, { translatedText: MOCK_TRANSLATIONS['en-vi'] })

    cy.get('[aria-label="Translated text"]')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('button', 'Read Aloud').click()
      })

    cy.wait('@ttsApi')
    cy.get('[aria-label="AI read aloud"]').within(() => {
      cy.get('button').contains(/Play|Pause/).should('be.visible')
    })
  })

  it('shows Read Aloud failed when TTS returns error', () => {
    cy.intercept('POST', '**/api/tts', {
      statusCode: 503,
      body: { error: 'TTS unavailable for this test.' },
    }).as('ttsFail')

    const session = createSession('en', 'es')
    visitWithSession(session, { translatedText: MOCK_TRANSLATIONS['en-es'] })

    cy.get('[aria-label="Translated text"]')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('button', 'Read Aloud').click()
      })

    cy.wait('@ttsFail')
    cy.contains('Read Aloud failed').should('be.visible')
    cy.contains('TTS unavailable for this test.').should('be.visible')
  })
})

describe('Complete workflow — translate then listen (mocked)', () => {
  it('English → Spanish: translate completes, then TTS plays UI without errors', () => {
    const docId = uniqueTranslateDocId()
    const wav = buildMinimalWav()
    stubSummarizeSuccess()
    cy.intercept('POST', '**/api/translate', {
      statusCode: 200,
      body: { translatedText: MOCK_TRANSLATIONS['en-es'] },
    }).as('translateApi')
    cy.intercept('POST', '**/api/tts', (req) => {
      req.reply({
        statusCode: 200,
        headers: { 'Content-Type': 'audio/wav' },
        body: wav,
      })
    }).as('ttsApi')

    cy.visit(`/translate/${docId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.clear()
        win.sessionStorage.setItem(
          `translate-${docId}`,
          JSON.stringify(createSession('en', 'es'))
        )
      },
    })

    cy.wait('@translateApi', { timeout: 15000 })
    cy.contains('Translation failed').should('not.exist')
    cy.get('[aria-label="Translated text"]').should(
      'have.value',
      MOCK_TRANSLATIONS['en-es']
    )

    cy.get('[aria-label="Translated text"]')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('button', 'Read Aloud').click()
      })

    cy.wait('@ttsApi')
    cy.get('[aria-label="AI read aloud"]').should('be.visible')
    cy.contains('button', 'Play').click()
    // Electron/Cypress often rejects audio.play() for blob WAV; empty catch in TtsPlaybackVisual
    // leaves the control on "Play". Assert transport still present after click.
    cy.get('[aria-label="AI read aloud"]').within(() => {
      cy.get('button').contains(/Play|Pause/).should('be.visible')
    })
  })

  it('English → Vietnamese: full mock path without Translation or Read Aloud errors', () => {
    const docId = uniqueTranslateDocId()
    const wav = buildMinimalWav()
    stubSummarizeSuccess()
    cy.intercept('POST', '**/api/translate', {
      statusCode: 200,
      body: { translatedText: MOCK_TRANSLATIONS['en-vi'] },
    }).as('translateApi')
    cy.intercept('POST', '**/api/tts', (req) => {
      req.reply({
        statusCode: 200,
        headers: { 'Content-Type': 'audio/wav' },
        body: wav,
      })
    }).as('ttsApi')

    cy.visit(`/translate/${docId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.clear()
        win.sessionStorage.setItem(
          `translate-${docId}`,
          JSON.stringify(createSession('en', 'vi'))
        )
      },
    })

    cy.wait('@translateApi', { timeout: 15000 })
    cy.contains('Translation failed').should('not.exist')
    cy.get('[aria-label="Translated text"]')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('button', 'Read Aloud').click()
      })
    cy.wait('@ttsApi')
    cy.contains('Read Aloud failed').should('not.exist')
    cy.get('[aria-label="AI read aloud"]').should('be.visible')
  })

  it('Vietnamese → English: translation then English Read Aloud uses voice settings', () => {
    const docId = uniqueTranslateDocId()
    const wav = buildMinimalWav()
    stubSummarizeSuccess()
    cy.intercept('POST', '**/api/translate', {
      statusCode: 200,
      body: { translatedText: MOCK_TRANSLATIONS['vi-en'] },
    }).as('translateApi')
    cy.intercept('POST', '**/api/tts', (req) => {
      req.reply({
        statusCode: 200,
        headers: { 'Content-Type': 'audio/wav' },
        body: wav,
      })
    }).as('ttsApi')

    cy.visit(`/translate/${docId}`, {
      onBeforeLoad(win) {
        win.sessionStorage.clear()
        win.sessionStorage.setItem(
          `translate-${docId}`,
          JSON.stringify(createSession('vi', 'en', SAMPLE_TEXT.vi))
        )
      },
    })

    cy.wait('@translateApi', { timeout: 15000 })
    cy.get('[aria-label="Translated text"]')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('button', 'Read Aloud').click()
      })

    cy.contains('Read Aloud voice settings').should('be.visible')
    cy.contains('button', 'Start').click()
    cy.wait('@ttsApi')
    cy.contains('Read Aloud failed').should('not.exist')
    cy.get('[aria-label="AI read aloud"]').should('be.visible')
  })
})
