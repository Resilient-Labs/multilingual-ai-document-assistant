/**
 * Question language for `/api/ask` + Ask chrome heuristics (EN / ES / VI).
 * Keep in sync with `resolveAskChromeLocale` / `answerLanguageForAskApi` in `AskTab.tsx`.
 *
 * Contributors: [Jasmin] — locale heuristics + short Spanish cues (`chao`, etc.); [Brandi] —
 * question language vs client RAG chunk language; [Karlee] — `answerLanguage` must match what
 * `buildSystemPrompt` tells the baseline HF model; [Team 1 eval] — gold Q&A rows (EN/ES/VI).
 */

/** Heuristic: English Ask phrasing — wins over session `sourceLang` so UI/API follow the question. */
export function looksLikeEnglishQuestion(q: string): boolean {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return false
  if (/\b(english|englsih|engligh|inglish)\b/i.test(t)) return true
  return /\b(hi|hey|hello|thanks|thank you|what|when|where|why|how|who|which|whose|should|would|could|can|can't|cannot|do|does|did|is|are|was|were|have|has|had|am|i'm|i am|please|help|explain|tell me|do i|am i|is there|are there|need to|have to|deadline|benefit|benefits|apply|applying|rights|document|documents|eligible|agreement|notice|this document|summarize|summary)\b/.test(
    t,
  )
}

/** Detect question language for /api/ask and UI — question text beats document `sourceLang`. */
export function detectAnswerLanguage(
  question: string,
  documentLanguage: string | undefined,
  translationTargetLang?: string,
): 'es' | 'en' | 'vi' {
  const q = question.trim().toLowerCase()
  if (!q) {
    const raw = documentLanguage?.trim().toLowerCase() ?? ''
    if (raw.startsWith('es')) return 'es'
    if (raw.startsWith('vi')) return 'vi'
    const tgt = translationTargetLang?.trim().toLowerCase() ?? ''
    if (tgt.startsWith('vi')) return 'vi'
    if (tgt.startsWith('es')) return 'es'
    return 'en'
  }
  if (/[¿¡]/.test(q)) return 'es'
  if (
    /\b(hola|buenas|buenos|gracias|muchas gracias|por favor|adiós|adios|disculpa|perdón|saludos|qué tal|buenas tardes|buenas noches|chao|chau|vale|bueno|hasta luego|nos vemos)\b/i.test(
      q,
    ) ||
    /\b(buen\s+día|buenos\s+días)\b/i.test(q)
  ) {
    return 'es'
  }
  if (
    /\b(qué|cual|cuál|cuando|cuándo|como|cómo|por qué|hay|debería|deberia|puede|puedes|puedo|explícalo|explicarlo|plazo|solicitud|documento|documentos|derechos|beneficio|usted|información)\b/.test(
      q,
    )
  ) {
    return 'es'
  }
  if (
    /\b(resumir|resumen|explica|explique|traducir|traduce|describe|describir|indique|señale|enumere|dime|cuéntame|cuentame|háblame|hableme|este|esta|estos|estas|aquí|aqui)\b/.test(
      q,
    )
  ) {
    return 'es'
  }
  /**
   * Vietnamese **before** Spanish `/[áéíóúñü]/`: words like **có** use the same U+00F3 as Spanish *ó*,
   * so a blanket Latin-accent shortcut mis-classifies VI as ES ([Jasmin] Apr 2026).
   */
  if (
    /[àáảãạăằắẳẵặâầấẩẫậêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹđ]/i.test(
      q,
    )
  ) {
    return 'vi'
  }
  if (
    /\b(xin\s*chào|cảm\s*ơn|vui\s*lòng|không|trong\s+tài\s*liệu|tài\s*liệu|giúp\s*tôi|hạn\s*nộp|quyền|quyền\s*lợi|thông\s*báo|thỏa\s*thuận|những)\b/i.test(
      q,
    )
  ) {
    return 'vi'
  }
  if (/[áéíóúñü]/.test(q)) return 'es'
  if (looksLikeEnglishQuestion(q)) return 'en'
  const raw = documentLanguage?.trim().toLowerCase() ?? ''
  if (raw.startsWith('es')) return 'es'
  if (raw.startsWith('vi')) return 'vi'
  const tgt = translationTargetLang?.trim().toLowerCase() ?? ''
  if (tgt.startsWith('vi')) return 'vi'
  /** Translate session target ES — same as empty-question branch; was missing and defaulted to EN ([Jasmin] Apr 2026). */
  if (tgt.startsWith('es')) return 'es'
  return 'en'
}
