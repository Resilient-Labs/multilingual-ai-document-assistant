export type TtsProvider = 'hf-space'

export type Gender = 'masculine' | 'feminine'

export interface TtsRequestPayload {
  text: string
  targetLang: string
  gender: Gender
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
