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

/** Below this (0–100), use general-bucket resources and generic verification guidance. */
export const SAFETY_CONFIDENCE_LOW = 40

/** When scam is likely and confidence is at least this, avoid institution-specific phones that could imply an unsolicited letter is official. */
export const SAFETY_CONFIDENCE_MIN_FOR_SCAM_RESOURCE_ADJUSTMENT = 55
