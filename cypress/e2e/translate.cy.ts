describe('Translation Page - Error Handling', () => {
  const docId = 'test-doc-123'
  const mockSession = {
    fullText: 'Hello world. This is a test document.',
    filename: 'test-document.pdf',
    sourceLang: 'en',
    targetLang: 'es',
  }

  describe('Session Expired', () => {
    it('shows session expired alert when no session data exists', () => {
      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.clear()
        },
      })

      cy.contains('Session expired').should('exist')
      cy.contains('No document data found').should('exist')
      cy.contains('Back to upload').should('exist')
    })

    it('navigates back to upload when clicking the button', () => {
      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.clear()
        },
      })

      cy.contains('Back to upload').click()
      cy.url().should('eq', Cypress.config().baseUrl + '/')
    })
  })

  describe('Translation API Errors', () => {
    it('shows error when translation service returns 503', () => {
      cy.intercept('POST', '/api/translate', {
        statusCode: 503,
        body: {
          error: 'The translation service is temporarily unavailable.',
          code: 'SERVICE_UNAVAILABLE',
        },
      }).as('translateFail')

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.wait('@translateFail')
      cy.contains('Translation failed').should('exist')
      cy.contains('temporarily unavailable').should('exist')
    })

    it('shows error when translation service returns 500', () => {
      cy.intercept('POST', '/api/translate', {
        statusCode: 500,
        body: {
          error: 'An unexpected error occurred.',
          code: 'INTERNAL_ERROR',
        },
      }).as('translateError')

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.wait('@translateError')
      cy.contains('Translation failed').should('exist')
    })

    it('shows error when network request fails', () => {
      cy.intercept('POST', '/api/translate', {
        forceNetworkError: true,
      }).as('networkError')

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.wait('@networkError')
      cy.contains('Translation failed').should('exist')
    })

    it('shows specific error message from API response', () => {
      const customError = 'Custom error from the translation service'
      cy.intercept('POST', '/api/translate', {
        statusCode: 422,
        body: { error: customError },
      }).as('customError')

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.wait('@customError')
      cy.contains(customError).should('exist')
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner while translation is in progress', () => {
      cy.intercept('POST', '/api/translate', (req) => {
        req.reply({
          delay: 2000,
          statusCode: 200,
          body: { translatedText: 'Hola mundo.' },
        })
      }).as('translateSlow')

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.get('[aria-label="Translating document"]').should('exist')

      cy.wait('@translateSlow')
      cy.get('[aria-label="Translating document"]').should('not.exist')
    })
  })

  describe('Successful Translation', () => {
    it('displays translated text when API succeeds', () => {
      const translatedText = 'Hola mundo. Este es un documento de prueba.'
      cy.intercept('POST', '/api/translate', {
        statusCode: 200,
        body: { translatedText },
      }).as('translateSuccess')

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.wait('@translateSuccess')
      cy.get('[aria-label="Translated text"]').should('have.value', translatedText)
    })
  })

  describe('Page Structure', () => {
    it('displays document filename and language direction', () => {
      cy.intercept('POST', '/api/translate', { body: { translatedText: 'test' } })

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.contains(mockSession.filename).should('exist')
      cy.contains('English').should('exist')
      cy.contains('Spanish').should('exist')
    })

    it('displays original document text', () => {
      cy.intercept('POST', '/api/translate', { body: { translatedText: 'test' } })

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.get('[aria-label="Original document text"]')
        .should('have.value', mockSession.fullText)
    })

    it('shows back button in header', () => {
      cy.intercept('POST', '/api/translate', { body: { translatedText: 'test' } })

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.contains('button', 'Back').should('exist')
    })

    it('navigates to home when clicking back button', () => {
      cy.intercept('POST', '/api/translate', { body: { translatedText: 'test' } })

      cy.visit(`/translate/${docId}`, {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            `translate-${docId}`,
            JSON.stringify(mockSession)
          )
        },
      })

      cy.contains('button', 'Back').click()
      cy.url().should('eq', Cypress.config().baseUrl + '/')
    })
  })
})
