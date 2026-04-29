import React from 'react'
import { UploadForm } from '@/components/upload-form'

const SOURCE_LANGUAGES = [
  'Detect language', 'English', 'Spanish', 'French', 'German',
  'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese', 'Korean',
  'Portuguese', 'Italian', 'Russian', 'Arabic', 'Hindi', 'Dutch',
  'Polish', 'Swedish', 'Turkish', 'Vietnamese',
]

const TARGET_LANGUAGES = SOURCE_LANGUAGES.filter(l => l !== 'Detect language')

describe('<UploadForm /> - All Languages', () => {

  it('renders all source language options', () => {
    cy.mount(<UploadForm />)
    cy.contains('button', 'Detect language').click()

    SOURCE_LANGUAGES.forEach(lang => {
      cy.get('[role="option"]').contains(lang).should('exist')
    })
  })

  it('renders all target language options', () => {
    cy.mount(<UploadForm />)
    cy.contains('button', 'Spanish').click()

    TARGET_LANGUAGES.forEach(lang => {
      cy.get('[role="option"]').contains(lang).should('exist')
    })
  })

  TARGET_LANGUAGES.forEach(lang => {
    it(`can select ${lang} as the target language`, () => {
      cy.mount(<UploadForm />)
      cy.contains('button', 'Spanish').click()
      cy.get('[role="option"]').contains(lang).click()
      cy.contains('button', lang).should('exist')
    })
  })
})