export type TtsProvider = 'deepgram' | 'xtts' | 'minimax' | 'coqui-local'

export type Gender = 'masculine' | 'feminine'

export type SpanishAccent =
  | 'argentine'
  | 'colombian'
  | 'latin-american'
  | 'mexican'
  | 'peninsular'

export interface TtsRequestPayload {
  text: string
  targetLang: string
  gender: Gender
  spanishAccent?: SpanishAccent
}

export interface TtsSynthesisResult {
  audio: ArrayBuffer
  contentType: string
  provider: TtsProvider
  model: string
}

export class TtsError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'TtsError'
    this.status = status
  }
}
