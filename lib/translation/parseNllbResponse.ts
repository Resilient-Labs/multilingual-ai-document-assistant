/**
 * Normalizes Hugging Face translation responses (pipeline / router) to plain text.
 * Supports current Inference Providers shape and legacy array payloads.
 */
export function extractTranslatedTextFromNllbResponse(data: unknown): string | null {
  if (typeof data === 'string' && data.trim() !== '') {
    return data
  }

  if (Array.isArray(data)) {
    const first = data[0]
    if (first && typeof first === 'object' && 'translation_text' in first) {
      const t = (first as { translation_text?: unknown }).translation_text
      if (typeof t === 'string' && t.trim() !== '') return t
    }
    if (typeof first === 'string' && first.trim() !== '') {
      return first
    }
    return null
  }

  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>
    if (typeof rec.translation_text === 'string' && rec.translation_text.trim() !== '') {
      return rec.translation_text
    }
  }

  return null
}
