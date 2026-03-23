/**
 * Team 5: Document categories from the safety analysis system prompt.
 * Used by downstream consumers (e.g. Naima) for category-to-next-steps mapping.
 */
export const SAFETY_DOCUMENT_CATEGORIES = [
  'Utility Bill',
  'IRS Tax Notice',
  'Medical Bill',
  'Debt Collection Letter',
  'Court Summons',
  'Lease Agreement',
  'Insurance Document',
  'Bank Statement',
  'Government Notice',
  'Promotional',
  'Unknown',
] as const

export type SafetyDocumentCategory = (typeof SAFETY_DOCUMENT_CATEGORIES)[number]
