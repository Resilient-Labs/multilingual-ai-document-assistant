/**
 * Entity model for the Multilingual AI Document Assistant.
 * Architecture: Zero-retention. All data in client (EntityDB).
 * Backend is stateless.
 *
 * Entity graph:
 * Document
 * ├── OCRBlock → FieldCandidate
 * ├── Chunk → Embedding
 * ├── Summary
 * ├── RiskFlag
 * ├── Language
 * └── ChatSession → ChatMessage
 */

// --- Document (root) ---

export interface Document {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: number
}

// --- OCRBlock (Team 1) ---

export interface OCRBlock {
  id: string
  documentId: string
  text: string
  confidence?: number
  page?: number
  bbox?: NormalizedBoundingBox
}

// --- FieldCandidate (Team 1) ---

export interface FieldCandidate {
  id: string
  documentId: string
  blockId?: string
  key: string
  value: string
  confidence?: number
}

// --- BoundingBox (Team 1) ---

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

// --- NormalizedBoundingBox (Team 1) ---
// Coordinates are normalized to 0-1 range relative to page dimensions

export interface NormalizedBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

// --- Chunk (Team 3) ---

export interface Chunk {
  id: string
  text: string
  tokenCount?: number
}

// --- Embedding (Team 3) ---

export interface Embedding {
  vector: number[]
  model?: string
}

// --- Summary (Team 2) ---

export interface Summary {
  text: string
  generatedAt: number
  model?: string
}

// --- ChatSession (Team 3) ---

export interface ChatSession {
  sessionId: string
  startedAt: number
}

// --- ChatMessage (Team 3) ---

export interface ChatMessage {
  role: 'user' | 'assistant'
  message: string
  timestamp: number
}

// --- Language (Team 4) ---

export interface Language {
  detected?: string
  userPreferred?: string
  translationEnabled?: boolean
}

// --- RiskFlag (Team 5) ---

export type SafetySeverity = 'low' | 'medium' | 'high' | 'urgent'

/** Coarse bucket for curated resource templates (maps from model category string). */
export type SafetyResourceBucket =
  | 'housing'
  | 'financial'
  | 'medical'
  | 'legal'
  | 'general'

/** Model-assessed legitimacy for scam-oriented escalation of next steps. */
export type SafetyLegitimacy = 'likely_legitimate' | 'uncertain' | 'likely_scam'

/** Curated action for the user (phone, link, or plain guidance). */
export interface RiskNextStep {
  label: string
  type: 'phone' | 'url' | 'info'
  /** Phone number or URL when type is phone or url */
  value?: string
}

/** UI-oriented view model; `summary` is null from the API (client may merge Team 2 Summary). */
export interface SafetyRecommendationPresentation {
  headline: string
  severityLabel: string
  summary: string | null
  primaryActions: RiskNextStep[]
  resources: RiskNextStep[]
  disclaimer: string
}

export interface RiskFlag {
  category: string
  severity: SafetySeverity
  /** Overall classification confidence 0–100 (from the model). */
  confidence?: number
  /** Document risk level; when omitted, treat as aligned with `severity`. */
  riskLevel?: SafetySeverity
  legitimacy?: SafetyLegitimacy
  explanation?: string
  /** Unix timestamp in milliseconds; set by the server when the analysis completes. */
  detectedAt: number
  /** 0-based character index in the analyzed text for highlighting (from the model). */
  evidenceCharOffset?: number
}

// --- Safety API (Team 5) ---

export interface SafetyFlags extends RiskFlag {
  nextSteps: RiskNextStep[]
}

export interface SafetyAnalysisResponse {
  flags: SafetyFlags
  presentation: SafetyRecommendationPresentation
}

export interface SafetyAnalysisRequest {
  fullText?: string
  blocks?: Array<{ text: string; confidence?: number }>
  /** Regex-extracted fields from OCR blocks (phones, emails, dates, amounts, kv). */
  fieldCandidates?: Array<Pick<FieldCandidate, 'key' | 'value' | 'confidence'>>
}

// --- OCR API response (from stateless backend) ---

export interface OCRResult {
  documentId: string
  fullText: string
  blocks: OCRBlock[]
  language?: string
}

// --- Team 1 Extraction Request/Response Contracts ---

export interface ExtractedPage {
  pageNumber: number
  width: number
  height: number
  blocks: OCRBlock[]
}

export interface ExtractedFile {
  fileIndex: number
  filename: string
  mimeType: string
  sizeBytes: number
  pages: ExtractedPage[]
}

export interface ExtractionResponse {
  document: Document
  ocr: OCRResult
  files: ExtractedFile[]
  fieldCandidates: FieldCandidate[]
  extractedAt: number
}

export interface ExtractionErrorResponse {
  error: string
  code: ExtractionErrorCode
  details?: Record<string, unknown>
}

export type ExtractionErrorCode =
  | 'NO_FILES'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_FILES'
  | 'OCR_FAILURE'
  | 'INTERNAL_ERROR'
