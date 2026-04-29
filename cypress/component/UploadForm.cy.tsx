import React from 'react'
import { UploadForm } from '@/components/upload-form'

describe('<UploadForm /> - File Upload', () => {

  it('renders empty dropzone initially', () => {
    cy.mount(<UploadForm />)
    cy.contains('Drag & drop or choose a file').should('exist')
    cy.contains('Browse files').should('exist')
    cy.get('button[type="submit"]').should('be.disabled')
  })

  it('displays file info after selection', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test content'),
      fileName: 'test-doc.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.contains('test-doc.pdf').should('exist')
    cy.get('button[type="submit"]').should('not.be.disabled')
  })

  it('shows file size in KB', () => {
    cy.mount(<UploadForm />)

    const content = 'x'.repeat(2048)
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(content),
      fileName: 'sized-file.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.contains('2 KB').should('exist')
  })

  it('can remove selected file', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test'),
      fileName: 'remove-me.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.contains('remove-me.pdf').should('exist')
    cy.get('[aria-label="Remove file"]').click()
    cy.contains('remove-me.pdf').should('not.exist')
    cy.get('button[type="submit"]').should('be.disabled')
  })

  it('can replace file by selecting another', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('first'),
      fileName: 'first.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.contains('first.pdf').should('exist')

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('second'),
      fileName: 'second.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.contains('second.pdf').should('exist')
    cy.contains('first.pdf').should('not.exist')
  })

  it('accepts PDF files', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('%PDF-1.4'),
      fileName: 'document.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.contains('document.pdf').should('exist')
  })

  it('accepts DOCX files', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('PK'),
      fileName: 'document.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }, { force: true })

    cy.contains('document.docx').should('exist')
  })

  it('accepts TXT files', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('Hello world'),
      fileName: 'notes.txt',
      mimeType: 'text/plain',
    }, { force: true })

    cy.contains('notes.txt').should('exist')
  })

  it('accepts image files', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from([0x89, 0x50, 0x4E, 0x47]),
      fileName: 'photo.png',
      mimeType: 'image/png',
    }, { force: true })

    cy.contains('photo.png').should('exist')
  })
})

describe('<UploadForm /> - Mobile Layout', () => {

  it('renders mobile-specific UI', () => {
    cy.mount(<UploadForm mobile />)
    cy.contains('Take a photo or upload a file').should('exist')
    cy.contains('Take photo').should('exist')
    cy.contains('10MB max').should('exist')
  })

  it('shows file info in mobile layout', () => {
    cy.mount(<UploadForm mobile />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('mobile test'),
      fileName: 'mobile-doc.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.contains('mobile-doc.pdf').should('exist')
    cy.contains('Tap to replace').should('exist')
  })

  it('can remove file in mobile layout', () => {
    cy.mount(<UploadForm mobile />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test'),
      fileName: 'mobile-remove.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.get('[aria-label="Remove file"]').click()
    cy.contains('mobile-remove.pdf').should('not.exist')
  })
})

describe('<UploadForm /> - Language Swap', () => {

  it('swap button is disabled when source is auto-detect', () => {
    cy.mount(<UploadForm />)
    cy.get('[aria-label="Swap languages"]').should('be.disabled')
  })

  it('swap button is enabled when source is not auto-detect', () => {
    cy.mount(<UploadForm />)

    cy.contains('button', 'Detect language').click()
    cy.get('[role="option"]').contains('English').click()

    cy.get('[aria-label="Swap languages"]').should('not.be.disabled')
  })

  it('swaps source and target languages', () => {
    cy.mount(<UploadForm />)

    cy.contains('button', 'Detect language').click()
    cy.get('[role="option"]').contains('French').click()

    cy.contains('button', 'French').should('exist')
    cy.contains('button', 'Spanish').should('exist')

    cy.get('[aria-label="Swap languages"]').click()

    cy.contains('button', 'Spanish').should('exist')
    cy.contains('button', 'French').should('exist')
  })
})

describe('<UploadForm /> - Submit Button State', () => {

  it('submit button is disabled without file', () => {
    cy.mount(<UploadForm />)
    cy.get('button[type="submit"]').should('be.disabled')
  })

  it('submit button is enabled with file', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('content'),
      fileName: 'ready.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.get('button[type="submit"]').should('not.be.disabled')
    cy.contains('Translate document').should('exist')
  })

  it('submit button becomes disabled after file removal', () => {
    cy.mount(<UploadForm />)

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('content'),
      fileName: 'temp.pdf',
      mimeType: 'application/pdf',
    }, { force: true })

    cy.get('button[type="submit"]').should('not.be.disabled')

    cy.get('[aria-label="Remove file"]').click()

    cy.get('button[type="submit"]').should('be.disabled')
  })
})
