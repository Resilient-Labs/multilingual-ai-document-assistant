'use client'

/**
 * AskTab — browser-side Q&A over the current document.
 *
 * Data flow (keep in sync with `app/api/ask/route.ts`):
 * 1. User types a question. We optionally run **client-side RAG**: `queryChunks(question)` reads
 *    vectors from **EntityDB (IndexedDB)** for this browser profile. Results are scoped by `docId`.
 * 2. If semantic search fails or times out, we fall back to sending the full `fullText` as a single
 *    "chunk" so the user still gets an answer (Brandi pipeline hardening can improve this later).
 * 3. We POST `{ question, chunks }` to `/api/ask`. The server does **not** have EntityDB — it only
 *    sees the strings we send.
 * 4. The API returns a **Vercel AI SDK UI message stream** (JSON lines), not a raw JSON `{ answer }`
 *    object. We decode it with `parseJsonEventStream` + `readUIMessageStream` from the `ai` package.
 * 5. **Source cards (V1):** collapsible list of **truncated RAG snippets actually POSTed** with the question
 *    (not model-attributed citations). Persisted as `sourceRefs` (snippet + optional `chunkId` + optional
 *    jump range in `fullText`) and legacy `sourceChunks` for older rows. Optional `onJumpToSource` scrolls
 *    / highlights the **original document** textarea on the translate page.
 * 6. **Follow-up chips:** static suggestions after the latest answer (Research Conclusions — AI-generated follow-ups later).
 * 7. **“Can’t determine”:** heuristic on reply wording + callout. **Confidence:** plain-language pill
 *    (draft overlap bands) — see TODO [Winnie] / [Brandi] in component; calibration accordion removed from UI.
 *
 * **State 1 (flow diagram):** until `countRagChunksForDoc(docId) > 0`, show empty state + “Go to Upload tab”
 * (no chips/input). Polls briefly after navigation so async chunking can finish.
 *
 * Privacy: first-time OK is stored in `sessionStorage` per `docId` (Team 1 / handoff — before first send).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'
import type { ParseResult } from '@ai-sdk/provider-utils'
import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from 'ai'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  countRagChunksForDoc,
  queryChunks,
  type AskSourceRef,
} from '@/lib/entitydb'
import { useChatHistory } from '@/hooks/useChatHistory'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  answerContainsSpanishSignals,
  answerLooksLikeCantDetermine,
  computeAskConfidenceBand,
  inferChipLocaleFromText,
} from '@/lib/askConfidenceBands'

// TODO [Zaria] — Guardrails ticket: all `ASK_PROMPT_PACK` strings (suggested chips, follow-ups, fallback, professional CTA, ES copy)
// v1 draft — final behavior pending Zaria's prompt rules, schema validation,
// input cleaning, output checking, refusal behavior, and domain restriction spec
// TODO [Karlee] — Baseline model & fine-tuning ticket: static prompts assume model will respond usefully to these phrasings
// Model quality not yet validated against eval set
// Fine-tuning decision pending Karlee's baseline eval results
// Do not treat current output quality as production-ready until Karlee's gate is passed
// TODO [Winnie] — Evaluation & calibration ticket: Spanish UI strings in this pack are not yet human-reviewed for tone and clarity
// Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
// Multilingual accuracy target: >85% per language — EN + ES only for V1

/** Suggested + follow-up chip copy by UI locale (aligned with document / session language). */
const ASK_PROMPT_PACK = {
  en: {
    chrome: {
      cardTitle: 'Ask about this document',
      preparingChunks:
        'Preparing your document for questions (checking saved chunks)…',
      loadingHistory: 'Loading history…',
      loading: 'Loading…',
      chatThreadEmpty: 'Ask a question about the document above.',
      ragEmptyTitle: 'No document ready to search yet',
      ragEmptyLead:
        "We did not find this document's text chunks in your browser's saved database (EntityDB). That usually means processing has not finished or nothing was uploaded from this device. Upload a document on the Upload tab, wait for processing, then open Ask again.",
      ragEmptyEx1: 'Example: “What are my rights under this agreement?”',
      ragEmptyEx2: 'Example: “Is there a deadline I need to act on?”',
      ragEmptyEx3: 'Example: “What is this notice asking me to do?”',
      goToUploadTab: 'Go to Upload tab',
      privacyModalTitle: 'How your question is answered',
      privacyModalBody:
        'Your question and selected document text are sent to our AI provider (Together AI) to generate an answer. We do not store your document on the server for this step. For sensitive topics (legal, medical, immigration), this tool does not replace a professional — see each answer’s reminders.',
      privacyModalOk: 'OK — I understand',
      privacyBannerTitle: 'Privacy',
      privacyBannerBody:
        'Review how your data is used before you ask a question.',
      privacyBannerButton: 'Open privacy notice',
      chatHistoryErrorTitle: 'Could not load chat history',
      chatHistoryErrorFallback: 'Unable to load chat history.',
      chatHistoryErrorRefresh: 'Refresh page',
      errorAlertTitle: 'Error',
    },
    inputPlaceholder: 'Ask a question…',
    sendButton: 'Send',
    inputAriaLabel: 'Question input',
    suggestedSection: 'Try asking:',
    suggested: [
      'Am I eligible for this benefit?',
      'What documents do I need to apply?',
      'What is the deadline to submit?',
      'What are my rights under this agreement?',
    ],
    followUp: [
      'What should I do next?',
      'Is there a deadline I should know about?',
      'Can you explain that in simpler words?',
    ],
    source: {
      pagePlaceholder: 'Page not available yet',
      expandPrefix: 'Source',
      tapToExpand: 'tap to expand',
      exactSentence: 'Exact sentence (retrieved)',
      fullPassageSent: 'Full passage sent to the model:',
      showInOriginal: 'Show in original document',
      highlightUnavailable:
        'Highlight unavailable — snippet may be truncated or not found verbatim in the document.',
      useTranslatePage:
        'Use the translate page for this document to jump and highlight in the original text.',
    },
    confidence: {
      cantBadgeLabel: "Can't determine",
      highSentence: 'We found a clear answer in your document',
      moderateSentence:
        'We found a partial answer — verify with the document',
      lowSentence:
        'We are not confident in this answer — please check the document directly',
    },
    cantCallout: {
      title: 'Not found in your document',
      body: 'We could not find a clear answer in your document. Try rephrasing your question or consult a qualified professional.',
      consultButton: 'Consult a professional',
    },
  },
  es: {
    chrome: {
      cardTitle: 'Preguntas sobre este documento',
      preparingChunks:
        'Preparando su documento para preguntas (comprobando los fragmentos guardados)…',
      loadingHistory: 'Cargando el historial…',
      loading: 'Cargando…',
      chatThreadEmpty: 'Haga una pregunta sobre el documento de arriba.',
      ragEmptyTitle: 'Aún no hay un documento listo para buscar',
      ragEmptyLead:
        'No encontramos los fragmentos de texto de este documento en la base de datos guardada en su navegador (EntityDB). Suele indicar que el procesamiento no terminó o que no se subió el archivo desde este dispositivo. Vaya a la pestaña de carga, espere a que termine el procesamiento y regrese aquí.',
      ragEmptyEx1: 'Ejemplo: «¿Cuáles son mis derechos según este acuerdo?»',
      ragEmptyEx2: 'Ejemplo: «¿Hay una fecha límite en la que deba actuar?»',
      ragEmptyEx3: 'Ejemplo: «¿Qué me pide este aviso?»',
      goToUploadTab: 'Ir a la pestaña de carga',
      privacyModalTitle: 'Cómo se responde su pregunta',
      privacyModalBody:
        'Su pregunta y el texto del documento seleccionado se envían a nuestro proveedor de IA (Together AI) para generar una respuesta. No guardamos su documento en el servidor en este paso. Para temas sensibles (legal, médico, inmigración), esta herramienta no sustituye a un profesional: revise los recordatorios de cada respuesta.',
      privacyModalOk: 'Entendido',
      privacyBannerTitle: 'Privacidad',
      privacyBannerBody:
        'Revise cómo se usan sus datos antes de hacer una pregunta.',
      privacyBannerButton: 'Abrir aviso de privacidad',
      chatHistoryErrorTitle: 'No se pudo cargar el historial del chat',
      chatHistoryErrorFallback:
        'No se pudo cargar el historial del chat. Intente actualizar la página.',
      chatHistoryErrorRefresh: 'Actualizar página',
      errorAlertTitle: 'Error',
    },
    inputPlaceholder: 'Haz una pregunta…',
    sendButton: 'Enviar',
    inputAriaLabel: 'Campo de pregunta',
    suggestedSection: 'Prueba preguntando:',
    suggested: [
      '¿Cumplo los requisitos para este beneficio?',
      '¿Qué documentos necesito para la solicitud?',
      '¿Cuál es la fecha límite para presentar?',
      '¿Cuáles son mis derechos según este acuerdo?',
    ],
    followUp: [
      '¿Qué debo hacer ahora?',
      '¿Hay algún plazo que deba conocer?',
      '¿Puede explicarlo en palabras más simples?',
    ],
    source: {
      pagePlaceholder: 'Página no disponible aún',
      expandPrefix: 'Fuente',
      tapToExpand: 'toca para expandir',
      exactSentence: 'Frase exacta (recuperada)',
      fullPassageSent: 'Fragmento completo enviado al modelo:',
      showInOriginal: 'Mostrar en el documento original',
      highlightUnavailable:
        'Resaltado no disponible: el fragmento puede estar truncado o no aparece tal cual en el texto.',
      useTranslatePage:
        'Usa la página de traducción de este documento para saltar y resaltar el texto original.',
    },
    confidence: {
      cantBadgeLabel: 'No pudimos encontrar esto en su documento',
      highSentence: 'Encontramos una respuesta clara en su documento',
      moderateSentence:
        'Encontramos una respuesta parcial — verifique con el documento',
      lowSentence:
        'No estamos seguros de esta respuesta — consulte el documento directamente',
    },
    cantCallout: {
      title: 'Sin respuesta clara en su documento',
      body: 'No pudimos encontrar una respuesta clara en su documento. Intente reformular su pregunta o consulte a un profesional calificado.',
      consultButton: 'Consultar a un profesional',
    },
  },
} as const

/** English follow-up chip labels — when the doc/session is Spanish, we still treat these as “Spanish UX” turns. */
const ASK_EN_FOLLOW_UP_CHIP_SET = new Set<string>(
  ASK_PROMPT_PACK.en.followUp as unknown as string[]
)

type AskChipLocale = keyof typeof ASK_PROMPT_PACK

function documentPageIsSpanish(documentLanguage: string | undefined): boolean {
  return (documentLanguage?.trim().toLowerCase() ?? '').startsWith('es')
}

/** API `answerLanguage`: Spanish doc or Spanish translate target + static English follow-up chip ⇒ still request Spanish from the model. */
function answerLanguageForAskApi(
  question: string,
  documentLanguage: string | undefined,
  translationTargetLang?: string
): 'es' | 'en' {
  const targetEs = (translationTargetLang?.trim().toLowerCase() ?? '').startsWith(
    'es'
  )
  if (
    (documentPageIsSpanish(documentLanguage) || targetEs) &&
    ASK_EN_FOLLOW_UP_CHIP_SET.has(question.trim())
  ) {
    return 'es'
  }
  return detectAnswerLanguage(question, documentLanguage)
}

// TODO [Brandi] — Data & inputs ticket: answer language vs chunk language can diverge when RAG pulls English slices for a Spanish question
// Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
// TODO [Winnie] — Evaluation & calibration ticket: locale from answer + heuristics must be validated on the 50 Q&A eval set (EN + ES)
// Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
// Multilingual accuracy target: >85% per language — EN + ES only for V1
/**
 * Best-effort: per–assistant-turn chrome follows answer text; when the reply is mixed or
 * ASCII-only Spanish, the paired user question nudges locale so chips/pills match “Enviar”.
 * If the user asked in Spanish, keep Spanish chrome for that turn even when the model answers in English (chunks/session often English).
 */
function inferUiLocaleFromAnswerText(
  answer: string,
  pairedUserQuestion: string | null | undefined,
  documentLanguage: string | undefined,
  translationTargetLang?: string
): AskChipLocale {
  const t = answer.trim()
  if (!t) return 'en'
  const fromAnswer = inferChipLocaleFromText(t)
  if (fromAnswer === 'es') return 'es'

  const q = pairedUserQuestion?.trim() ?? ''
  const userLang = q ? detectAnswerLanguage(q, documentLanguage) : 'en'

  const targetEs = (translationTargetLang?.trim().toLowerCase() ?? '').startsWith(
    'es'
  )
  if (
    (documentPageIsSpanish(documentLanguage) || targetEs) &&
    q &&
    ASK_EN_FOLLOW_UP_CHIP_SET.has(q)
  ) {
    return 'es'
  }

  if (userLang === 'es') return 'es'

  if (userLang === 'en' && answerContainsSpanishSignals(t)) {
    return 'es'
  }

  return 'en'
}

/** Prefer explicit session/document language; otherwise infer from document text. */
function resolveAskChipLocale(
  documentLanguage: string | undefined,
  fullText: string
): AskChipLocale {
  const raw = documentLanguage?.trim().toLowerCase() ?? ''
  if (raw.startsWith('es')) return 'es'
  if (raw.startsWith('en')) return 'en'
  return inferChipLocaleFromText(fullText)
}

function sourcePassageCountLabel(locale: AskChipLocale, count: number): string {
  if (count === 1) return locale === 'es' ? '1 pasaje' : '1 passage'
  return locale === 'es' ? `${count} pasajes` : `${count} passages`
}

/** Heuristic: English Ask phrasing — wins over session `sourceLang` so UI/API follow the question. */
function looksLikeEnglishQuestion(q: string): boolean {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return false
  return /\b(hi|hey|hello|thanks|thank you|what|when|where|why|how|who|which|whose|should|would|could|can|can't|cannot|do|does|did|is|are|was|were|have|has|had|am|i'm|i am|please|help|explain|tell me|do i|am i|is there|are there|need to|have to|deadline|benefit|benefits|apply|applying|rights|document|documents|eligible|agreement|notice|this document|summarize|summary)\b/.test(
    t
  )
}

function lastUserMessageContent(
  messages: Array<{ role: string; content: string }>
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && m.content.trim()) return m.content
  }
  return null
}

function lastAssistantMessageContent(
  messages: Array<{ role: string; content: string }>
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'assistant' && m.content.trim()) return m.content
  }
  return null
}

/**
 * Chips, pills, placeholders: follow last user question; before first ask, use document/session.
 * Short Spanish (e.g. "hola") is detected explicitly; if the user line is still ambiguous English,
 * the last assistant reply nudges UI to match the conversation (no session reset needed).
 */
function resolveAskUiLocale(
  messages: Array<{ role: string; content: string }>,
  documentLanguage: string | undefined,
  fullText: string,
  translationTargetLang?: string
): AskChipLocale {
  const last = lastUserMessageContent(messages)?.trim() ?? ''
  if (!last) {
    const tgt = translationTargetLang?.trim().toLowerCase() ?? ''
    if (tgt.startsWith('es')) return 'es'
    return resolveAskChipLocale(documentLanguage, fullText)
  }

  let fromUser = detectAnswerLanguage(last, documentLanguage)
  const assistant = lastAssistantMessageContent(messages)?.trim() ?? ''
  if (
    assistant &&
    last.length <= 28 &&
    fromUser === 'en' &&
    !looksLikeEnglishQuestion(last) &&
    detectAnswerLanguage(assistant.slice(0, 6000), documentLanguage) === 'es'
  ) {
    fromUser = 'es'
  }

  return fromUser === 'es' ? 'es' : 'en'
}

/** Detect question language for /api/ask and UI — question text beats document `sourceLang`. */
function detectAnswerLanguage(
  question: string,
  documentLanguage: string | undefined
): 'es' | 'en' {
  const q = question.trim().toLowerCase()
  if (!q) {
    const raw = documentLanguage?.trim().toLowerCase() ?? ''
    return raw.startsWith('es') ? 'es' : 'en'
  }
  if (/[áéíóúñü¿¡]/.test(q)) return 'es'
  if (
    /\b(hola|buenas|buenos|gracias|muchas gracias|por favor|adiós|adios|disculpa|perdón|saludos|qué tal|buenas tardes|buenas noches)\b/i.test(
      q
    ) ||
    /\b(buen\s+día|buenos\s+días)\b/i.test(q)
  ) {
    return 'es'
  }
  if (
    /\b(qué|cual|cuál|cuando|cuándo|como|cómo|por qué|hay|debería|deberia|puede|puedes|puedo|explícalo|explicarlo|plazo|solicitud|documento|documentos|derechos|beneficio|usted|información)\b/.test(
      q
    )
  ) {
    return 'es'
  }
  if (
    /\b(resumir|resumen|explica|explique|traducir|traduce|describe|describir|indique|señale|enumere|dime|cuéntame|cuentame|háblame|hableme|este|esta|estos|estas|aquí|aqui)\b/i.test(
      q
    )
  ) {
    return 'es'
  }
  if (looksLikeEnglishQuestion(q)) return 'en'
  const raw = documentLanguage?.trim().toLowerCase() ?? ''
  if (raw.startsWith('es')) return 'es'
  return 'en'
}

// TODO [Winnie] — Evaluation & calibration ticket: Spanish `ASK_ERROR_COPY` strings need human review and eval alignment
// Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
// Multilingual accuracy target: >85% per language — EN + ES only for V1
// TODO [Zaria] — Guardrails ticket: error / offline messaging should match Zaria’s tone and domain-safe wording in EN + ES
// v1 draft — final behavior pending Zaria's prompt rules, schema validation,
// input cleaning, output checking, refusal behavior, and domain restriction spec
const ASK_ERROR_COPY = {
  en: {
    offline:
      'You appear to be offline. Please check your connection and try again.',
    modelTimeout: 'This is taking longer than expected. Please try again.',
    modelFailure:
      'Something went wrong answering your question. Please try again.',
    sessionEnded:
      'Your session has ended. Please go back to the Upload tab to continue.',
    tryAgain: 'Try again',
    goToUpload: 'Go to Upload tab',
  },
  es: {
    offline:
      'Parece que no tiene conexión. Verifique su conexión e intente de nuevo.',
    modelTimeout:
      'Esto está tardando más de lo esperado. Por favor intente de nuevo.',
    modelFailure: 'Algo salió mal. Por favor intente de nuevo.',
    sessionEnded:
      'Su sesión ha terminado. Regrese a la pestaña de carga para continuar.',
    tryAgain: 'Intentar de nuevo',
    goToUpload: 'Ir a la pestaña de carga',
  },
} as const

function askErrorLocale(
  question: string,
  documentLanguage: string | undefined
): AskChipLocale {
  return detectAnswerLanguage(question, documentLanguage) === 'es'
    ? 'es'
    : 'en'
}

const ASK_ERROR_MESSAGES_ES = new Set<string>([
  ASK_ERROR_COPY.es.offline,
  ASK_ERROR_COPY.es.modelTimeout,
  ASK_ERROR_COPY.es.modelFailure,
  ASK_ERROR_COPY.es.sessionEnded,
])

function errorChromeLocale(error: string | null): AskChipLocale {
  if (error && ASK_ERROR_MESSAGES_ES.has(error)) return 'es'
  return 'en'
}

function isSessionEndedAskError(error: string | null): boolean {
  if (!error) return false
  return (
    error === ASK_ERROR_COPY.en.sessionEnded ||
    error === ASK_ERROR_COPY.es.sessionEnded
  )
}

// TODO [Brandi] — Data & inputs ticket: `SNIPPET_MAX` truncates retrieved chunk text stored/shown on source cards (not final sentence boundaries)
// Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
const SNIPPET_MAX = 450

/** DOM id for focus after send — `Input` is not `forwardRef` in this codebase. */
const ASK_QUESTION_INPUT_ID = 'ask-tab-question-input'

/** Hide chip when it matches typed input or (for follow-ups) the last user turn — avoids repeating the same line in chips + input. */
function promptsExcludingDuplicates(
  prompts: readonly string[],
  opts: { inputValue: string; hideIfMatchesUserTurn?: string | null }
): string[] {
  const cur = opts.inputValue.trim().toLowerCase()
  const userTurn = opts.hideIfMatchesUserTurn?.trim().toLowerCase() ?? ''
  return prompts.filter((p) => {
    const t = p.trim().toLowerCase()
    if (t === cur) return false
    if (userTurn && t === userTurn) return false
    return true
  })
}

function lastUserContentBeforeAssistantIndex(
  messages: Array<{ role: string; content: string }>,
  assistantIndex: number
): string | null {
  for (let j = assistantIndex - 1; j >= 0; j--) {
    if (messages[j].role === 'user') return messages[j].content
  }
  return null
}

/**
 * NOTE — Session persistence vs Team 1 spec: history is loaded/stored via `useChatHistory`
 * (EntityDB in the browser). That survives full page reload until product changes storage to
 * session-scoped only; adjusting that requires `useChatHistory` / EntityDB, not this tab alone.
 */

function privacyStorageKey(docId: string) {
  return `ask_privacy_ok_${docId}`
}

function textFromAssistantMessage(message: UIMessage): string {
  if (message.role !== 'assistant') return ''
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof part.text === 'string'
    )
    .map((part) => part.text)
    .join('')
}

function truncateForSourceStore(text: string, max = SNIPPET_MAX): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function findSnippetRange(
  fullText: string,
  chunkText: string
): { charStart: number; matchLen: number } | null {
  const needle = chunkText.trim()
  if (!needle) return null
  let idx = fullText.indexOf(needle)
  if (idx < 0) {
    const head = needle.slice(0, Math.min(140, needle.length))
    idx = head.length ? fullText.indexOf(head) : -1
  }
  if (idx < 0) return null
  const end = Math.min(idx + needle.length, fullText.length)
  return { charStart: idx, matchLen: Math.max(1, end - idx) }
}

function buildSourceRefs(
  parts: Array<{ text: string; chunkId?: string }>,
  fullText: string
): AskSourceRef[] {
  return parts.map((p) => {
    const range = findSnippetRange(fullText, p.text)
    return {
      snippet: truncateForSourceStore(p.text),
      ...(p.chunkId ? { chunkId: p.chunkId } : {}),
      ...(range ? { charStart: range.charStart, matchLen: range.matchLen } : {}),
    }
  })
}

/** Merge persisted `sourceRefs` with legacy `sourceChunks` (no jump until overlap finds a span). */
function sourcesForDisplay(
  msg: { sourceRefs?: AskSourceRef[]; sourceChunks?: string[] },
  fullText: string
): AskSourceRef[] {
  if (msg.sourceRefs?.length) return msg.sourceRefs
  const chunks = msg.sourceChunks
  if (!chunks?.length) return []
  return chunks.map((snippet) => {
    const range = findSnippetRange(fullText, snippet)
    return {
      snippet,
      ...(range ? { charStart: range.charStart, matchLen: range.matchLen } : {}),
    }
  })
}

// TODO [Brandi] — Data & inputs ticket: `firstSentenceFromSnippet` approximates “exact sentence” from truncated chunk text (no real sentence spans yet)
// Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
/** “Exact sentence” for expanded source — until Brandi supplies sentence boundaries per chunk. */
function firstSentenceFromSnippet(snippet: string): string {
  const t = snippet.trim()
  if (!t) return ''
  const m = t.match(/^[^.!?…]+[.!?…]?/)
  return (m ? m[0] : t.slice(0, 240)).trim()
}

function contextForOverlap(msg: { sourceRefs?: AskSourceRef[]; sourceChunks?: string[] }, fullText: string): string {
  const refs = sourcesForDisplay(msg, fullText)
  if (refs.length > 0) return refs.map((r) => r.snippet).join('\n')
  // TODO [Brandi] — Data & inputs ticket: overlap context falls back to first 8k of `fullText` when no source snippets — not chunk-aligned
  // Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
  return fullText.slice(0, 8000)
}

interface PendingMessage {
  role: 'user' | 'assistant'
  content: string
  /** Structured RAG sources for this turn (persisted on assistant). */
  sourceRefs?: AskSourceRef[]
}

export interface AskTabProps {
  docId: string
  fullText: string
  className?: string
  /** When set, “Show in original document” uses selection + scroll on that textarea. */
  onJumpToSource?: (range: { charStart: number; matchLen: number }) => void
  /**
   * BCP-style language for chip copy (e.g. session `sourceLang` on translate page).
   * When omitted or `auto`, locale is inferred from `fullText` (Spanish markers / common words).
   */
  documentLanguage?: string
  /**
   * Translate flow: session `targetLang` (e.g. `es`). When Spanish, Ask chrome matches
   * translation + summary before the first question even if the source document is English.
   */
  translationTargetLang?: string
}

/** State 1 vs ready — UI flow diagram (EntityDB has RAG chunks for this doc). */
type RagChunkStatus = 'checking' | 'empty' | 'ready'

export function AskTab({
  docId,
  fullText,
  className,
  onJumpToSource,
  documentLanguage,
  translationTargetLang,
}: AskTabProps) {
  const chatHistory = useChatHistory(docId)
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [privacyHydrated, setPrivacyHydrated] = useState(false)
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [privacyGateOpen, setPrivacyGateOpen] = useState(false)
  const [ragChunkStatus, setRagChunkStatus] =
    useState<RagChunkStatus>('checking')
  const pendingQuestionRef = useRef<string | null>(null)
  /** Last question sent — for error Retry (flow diagram). */
  const lastQuestionForRetryRef = useRef<string | null>(null)

  const displayMessages = useMemo(
    () => [...chatHistory.messages, ...pendingMessages],
    [chatHistory.messages, pendingMessages]
  )

  const { askPromptPack } = useMemo(() => {
    const locale = resolveAskUiLocale(
      displayMessages,
      documentLanguage,
      fullText,
      translationTargetLang
    )
    return {
      askPromptPack: ASK_PROMPT_PACK[locale],
    }
  }, [displayMessages, documentLanguage, fullText, translationTargetLang])

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory.messages, pendingMessages])

  // Restore privacy consent for this docId within the browser session (handoff: tab switch OK, full reload clears).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const ok = sessionStorage.getItem(privacyStorageKey(docId)) === '1'
      setPrivacyAcknowledged(ok)
    } catch {
      setPrivacyAcknowledged(false)
    }
    setPrivacyHydrated(true)
  }, [docId])

  // Poll briefly: chunking/embeddings run async after upload (flow: no input until chunks exist).
  // TODO [Brandi] — Data & inputs ticket: polling `countRagChunksForDoc` bridges upload vs Ask race until pipeline + upload-form are hardened
  // Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
  useEffect(() => {
    if (!docId) return
    let cancelled = false
    const maxAttempts = 14
    const delayMs = 1200

    async function probeChunks() {
      setRagChunkStatus('checking')
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return
        const n = await countRagChunksForDoc(docId)
        if (cancelled) return
        if (n > 0) {
          setRagChunkStatus('ready')
          return
        }
        await new Promise((r) => setTimeout(r, delayMs))
      }
      if (!cancelled) setRagChunkStatus('empty')
    }

    void probeChunks()
    return () => {
      cancelled = true
    }
  }, [docId])

  const acknowledgePrivacy = useCallback(() => {
    try {
      sessionStorage.setItem(privacyStorageKey(docId), '1')
    } catch {
      /* sessionStorage may be blocked — still allow proceed */
    }
    setPrivacyAcknowledged(true)
    setPrivacyGateOpen(false)
  }, [docId])

  const runAsk = useCallback(
    async (question: string) => {
      setError(null)
      lastQuestionForRetryRef.current = question
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const eloc = askErrorLocale(question, documentLanguage)
        setError(ASK_ERROR_COPY[eloc].offline)
        queueMicrotask(() => {
          if (typeof document === 'undefined') return
          document.getElementById(ASK_QUESTION_INPUT_ID)?.focus()
        })
        return
      }
      setIsLoading(true)
      // Streaming spec: show user bubble + three-dot assistant row immediately (before RAG returns).
      setPendingMessages([
        { role: 'user', content: question },
        { role: 'assistant', content: '', sourceRefs: [] },
      ])

      // --- Client RAG: top chunks for this doc, or full document text as fallback ---
      // TODO [Brandi] — Data & inputs ticket: falls back to full `fullText` when semantic hits are empty, time out, or fail — not sized/overlapped like real chunks
      // Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
      let ragParts: Array<{ text: string; chunkId?: string }>
      try {
        // TODO [Brandi] — Data & inputs ticket: `queryChunks` limit (5) and ranking depend on client chunking + embeddings quality
        // Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
        const results = await Promise.race([
          queryChunks(question, { limit: 5 }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('queryChunks timeout')), 3000)
          ),
        ])
        const scopedResults = results.filter((r) => r.docId === docId)
        ragParts =
          scopedResults.length > 0
            ? scopedResults.map((r) => ({
                text: r.text,
                ...(r.chunkId ? { chunkId: r.chunkId } : {}),
              }))
            : [{ text: fullText }]
      } catch {
        ragParts = [{ text: fullText }]
      }

      const chunks = ragParts.map((p) => p.text)
      const sourceRefs = buildSourceRefs(ragParts, fullText)
      const sourceSnippets = sourceRefs.map((r) => r.snippet)
      setPendingMessages([
        { role: 'user', content: question },
        { role: 'assistant', content: '', sourceRefs },
      ])

      try {
        // TODO [Karlee] — Baseline model & fine-tuning ticket: `/api/ask` answer quality and streaming behavior depend on baseline model + prompt pack
        // Model quality not yet validated against eval set
        // Fine-tuning decision pending Karlee's baseline eval results
        // Do not treat current output quality as production-ready until Karlee's gate is passed
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            chunks,
            answerLanguage: answerLanguageForAskApi(
              question,
              documentLanguage,
              translationTargetLang
            ),
          }),
        })

        if (!res.ok) {
          const eloc = askErrorLocale(question, documentLanguage)
          if (res.status === 401 || res.status === 403) {
            setError(ASK_ERROR_COPY[eloc].sessionEnded)
            setPendingMessages([])
            return
          }
          if (res.status === 408 || res.status === 504) {
            setError(ASK_ERROR_COPY[eloc].modelTimeout)
            setPendingMessages([])
            return
          }
          await res.json().catch(() => ({}))
          setError(ASK_ERROR_COPY[eloc].modelFailure)
          setPendingMessages([])
          return
        }

        if (!res.body) {
          const eloc = askErrorLocale(question, documentLanguage)
          setError(ASK_ERROR_COPY[eloc].modelFailure)
          setPendingMessages([])
          return
        }

        // Decode UI message stream (same pipeline as AI SDK DefaultChatTransport).
        const chunkStream = parseJsonEventStream({
          stream: res.body,
          schema: uiMessageChunkSchema,
        }).pipeThrough(
          new TransformStream<ParseResult<UIMessageChunk>, UIMessageChunk>({
            transform(chunk, controller) {
              if (!chunk.success) {
                throw chunk.error
              }
              controller.enqueue(chunk.value)
            },
          })
        )

        // Provider failures (e.g. Together 402 billing) arrive as stream `error` chunks, not HTTP 4xx.
        // Without terminateOnError, the iterator completes and we commit empty assistant text.
        const messageStream = readUIMessageStream({
          stream: chunkStream,
          terminateOnError: true,
        })
        let finalText = ''

        for await (const uiMessage of messageStream) {
          if (uiMessage.role === 'assistant') {
            finalText = textFromAssistantMessage(uiMessage)
            setPendingMessages([
              { role: 'user', content: question },
              {
                role: 'assistant',
                content: finalText,
                sourceRefs,
              },
            ])
          }
        }

        await chatHistory.addMessage('user', question)
        await chatHistory.addMessage('assistant', finalText, {
          sourceRefs,
          sourceChunks: sourceSnippets,
        })
        setPendingMessages([])
      } catch (err) {
        const eloc = askErrorLocale(question, documentLanguage)
        const msg = err instanceof Error ? err.message : String(err)
        if (
          /\b401\b|\b403\b/i.test(msg) ||
          /unauthorized|forbidden/i.test(msg.toLowerCase())
        ) {
          setError(ASK_ERROR_COPY[eloc].sessionEnded)
        } else if (
          /abort|timeout|timed out|network|failed to fetch|load failed|querychunks timeout/i.test(
            msg
          )
        ) {
          setError(ASK_ERROR_COPY[eloc].modelTimeout)
        } else {
          setError(ASK_ERROR_COPY[eloc].modelFailure)
        }
        setPendingMessages([])
      } finally {
        setIsLoading(false)
        queueMicrotask(() => {
          if (typeof document === 'undefined') return
          document.getElementById(ASK_QUESTION_INPUT_ID)?.focus()
        })
      }
    },
    // chatHistory.addMessage is stable; full chatHistory in deps would re-run every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only addMessage + doc slice needed
    [fullText, docId, documentLanguage, translationTargetLang, chatHistory.addMessage]
  )

  const handleSubmit = useCallback(async () => {
    const question = input.trim()
    if (!question || isLoading || ragChunkStatus !== 'ready') return

    if (!privacyAcknowledged) {
      pendingQuestionRef.current = question
      setPrivacyGateOpen(true)
      return
    }

    setInput('')
    await runAsk(question)
  }, [input, isLoading, privacyAcknowledged, ragChunkStatus, runAsk])

  useEffect(() => {
    if (!privacyAcknowledged || !privacyHydrated) return
    const pending = pendingQuestionRef.current
    if (!pending) return
    pendingQuestionRef.current = null
    setInput('')
    void runAsk(pending)
  }, [privacyAcknowledged, privacyHydrated, runAsk])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  /** Top suggested chips: only before the first user question; hide for the rest of the session. */
  const hasAnyUserQuestion = displayMessages.some((m) => m.role === 'user')
  const showTopSuggestedChips = !hasAnyUserQuestion

  /** Vivid follow-ups only under the latest fully completed assistant reply (see spec). */
  const followUpVividAssistantIndex = (() => {
    const n = displayMessages.length
    if (n === 0) return -1
    const last = displayMessages[n - 1]
    if (last.role === 'assistant' && !isLoading) return n - 1
    return -1
  })()

  return (
    <Card className={cn('flex w-full flex-col overflow-hidden', className)}>
      <CardHeader>
        <CardTitle>{askPromptPack.chrome.cardTitle}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {ragChunkStatus === 'checking' && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-3" aria-hidden="true" />
            {askPromptPack.chrome.preparingChunks}
          </span>
        )}

        {ragChunkStatus === 'empty' && (
          <div className="grid gap-3 text-sm">
            <p className="text-lg font-semibold text-foreground">
              {askPromptPack.chrome.ragEmptyTitle}
            </p>
            <p className="text-muted-foreground">
              {askPromptPack.chrome.ragEmptyLead}
            </p>
            <ul className="list-inside list-disc text-muted-foreground">
              <li>{askPromptPack.chrome.ragEmptyEx1}</li>
              <li>{askPromptPack.chrome.ragEmptyEx2}</li>
              <li>{askPromptPack.chrome.ragEmptyEx3}</li>
            </ul>
            <Button asChild className="w-fit" variant="default">
              <Link href="/">{askPromptPack.chrome.goToUploadTab}</Link>
            </Button>
          </div>
        )}

        {ragChunkStatus === 'ready' && (
          <>
            {/* First-send privacy gate (Team 1 handoff) */}
            <Dialog open={privacyGateOpen} onOpenChange={setPrivacyGateOpen}>
              <DialogContent showCloseButton={false}>
                {/* TODO [Zaria] — Guardrails ticket: first-send privacy modal copy (disclosure + professional referral framing)
                    v1 draft — final behavior pending Zaria's prompt rules, schema validation,
                    input cleaning, output checking, refusal behavior, and domain restriction spec */}
                <DialogHeader>
                  <DialogTitle>{askPromptPack.chrome.privacyModalTitle}</DialogTitle>
                  <DialogDescription className="text-left">
                    {askPromptPack.chrome.privacyModalBody}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => {
                      acknowledgePrivacy()
                    }}
                  >
                    {askPromptPack.chrome.privacyModalOk}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {chatHistory.error && (
              <Alert variant="destructive">
                <AlertTitle>{askPromptPack.chrome.chatHistoryErrorTitle}</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>
                    {chatHistory.error?.trim()
                      ? chatHistory.error
                      : askPromptPack.chrome.chatHistoryErrorFallback}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.location.reload()
                    }}
                  >
                    {askPromptPack.chrome.chatHistoryErrorRefresh}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!privacyHydrated ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-3" aria-hidden="true" />
                {askPromptPack.chrome.loading}
              </span>
            ) : !privacyAcknowledged ? (
              <Alert>
                <AlertTitle>{askPromptPack.chrome.privacyBannerTitle}</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>{askPromptPack.chrome.privacyBannerBody}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setPrivacyGateOpen(true)}
                  >
                    {askPromptPack.chrome.privacyBannerButton}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex max-h-80 min-h-[120px] flex-col gap-3 overflow-y-auto pr-1">
              {showTopSuggestedChips && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {/* TODO [Brandi] — Data & inputs ticket: top suggested chips default to English before first question — no chunk-derived niche yet
                      Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed */}
                  {/* TODO [Winnie] — Evaluation & calibration ticket: English-only top chips + multilingual flows need eval sign-off
                      Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
                      Multilingual accuracy target: >85% per language — EN + ES only for V1 */}
                  {/* TODO [Zaria] — Guardrails ticket: top suggested chip wording must pass domain + guardrail review
                      v1 draft — final behavior pending Zaria's prompt rules, schema validation,
                      input cleaning, output checking, refusal behavior, and domain restriction spec */}
                  {/* TODO [Karlee] — Baseline model & fine-tuning ticket: suggested chip prompts assume model answers usefully from cold start
                      Model quality not yet validated against eval set
                      Fine-tuning decision pending Karlee's baseline eval results
                      Do not treat current output quality as production-ready until Karlee's gate is passed */}
                  {/* TODO [Brandi] — Data & inputs ticket: suggested prompts stay generic until chunk metadata can classify document niche
                      Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed */}
                  <p className="w-full text-xs font-medium text-muted-foreground">
                    {askPromptPack.suggestedSection}
                  </p>
                  {promptsExcludingDuplicates(askPromptPack.suggested, {
                    inputValue: input,
                  }).map((label) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={
                        isLoading ||
                        !privacyHydrated ||
                        !privacyAcknowledged ||
                        Boolean(chatHistory.error)
                      }
                      onClick={() => setInput(label)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
              {chatHistory.loading ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-3" aria-hidden="true" />
                  {askPromptPack.chrome.loadingHistory}
                </span>
              ) : displayMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {askPromptPack.chrome.chatThreadEmpty}
                </p>
              ) : null}

              {!chatHistory.loading &&
                displayMessages.map((msg, i) => {
              const isAssistant = msg.role === 'assistant'
              const isLast = i === displayMessages.length - 1
              const isLastAssistantLoading =
                isAssistant && isLast && isLoading && msg.content === ''
              const isStreamingThisAssistant =
                isAssistant && isLast && isLoading
              const pairedUserQuestion = isAssistant
                ? lastUserContentBeforeAssistantIndex(displayMessages, i)
                : null
              const answerLocale =
                isAssistant && msg.content.trim().length > 0
                  ? inferUiLocaleFromAnswerText(
                      msg.content,
                      pairedUserQuestion,
                      documentLanguage,
                      translationTargetLang
                    )
                  : 'en'
              const packForAnswer = ASK_PROMPT_PACK[answerLocale]
              const assistantPostStreamReady =
                isAssistant &&
                msg.content.trim().length > 0 &&
                !isStreamingThisAssistant

              return (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col gap-1',
                    isAssistant ? 'items-start' : 'items-end'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      isAssistant
                        ? 'bg-muted text-foreground'
                        : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {isLastAssistantLoading ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Spinner className="size-3" aria-hidden="true" />
                        <span className="inline-flex gap-0.5" aria-hidden>
                          <span className="animate-pulse">·</span>
                          <span className="animate-pulse delay-100">·</span>
                          <span className="animate-pulse delay-200">·</span>
                        </span>
                        Looking through your document…
                      </span>
                    ) : !msg.content.trim() && isAssistant ? (
                      <span className="text-muted-foreground">
                        No answer was returned.
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {isAssistant && assistantPostStreamReady && (
                      <div className="flex w-full min-w-0 max-w-full flex-col gap-2 sm:max-w-[min(100%,36rem)]">
                        {/* TODO [Winnie] — Evaluation & calibration ticket: “can’t determine” uses `answerLooksLikeCantDetermine` regex heuristics only
                            Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
                            Multilingual accuracy target: >85% per language — EN + ES only for V1 */}
                        {/* TODO [Brandi] — Data & inputs ticket: false “can’t determine” may fire when chunks are missing, late, or low quality
                            Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed */}
                        {answerLooksLikeCantDetermine(msg.content) && (
                          <Alert className="border-muted-foreground/40 bg-muted/60">
                            {/* TODO [Zaria] — Guardrails ticket: “not found” callout + professional CTA copy (EN/ES) needs guardrail + referral review
                                v1 draft — final behavior pending Zaria's prompt rules, schema validation,
                                input cleaning, output checking, refusal behavior, and domain restriction spec */}
                            <AlertTitle>
                              {packForAnswer.cantCallout.title}
                            </AlertTitle>
                            <AlertDescription className="flex flex-col gap-2">
                              <span>{packForAnswer.cantCallout.body}</span>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="w-fit"
                                asChild
                              >
                                <a
                                  href="https://www.usa.gov/legal-aid"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {packForAnswer.cantCallout.consultButton}
                                </a>
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}
                        {(() => {
                          const ctx = contextForOverlap(msg, fullText)
                          const band = computeAskConfidenceBand(
                            msg.content,
                            ctx
                          )
                          const refs = sourcesForDisplay(msg, fullText)
                          const cant = answerLooksLikeCantDetermine(msg.content)
                          return (
                            <>
                              {/* TODO [Winnie] — Evaluation & calibration ticket: band = `computeAskConfidenceBand` from `lib/askConfidenceBands.ts` (same constants logged by `/api/ask`)
                                  Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
                                  Multilingual accuracy target: >85% per language — EN + ES only for V1 */}
                              {/* TODO [Brandi] — Data & inputs ticket: badge context uses retrieved snippets / `fullText` — chunk quality skews overlap and language
                                  Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed */}
                              {/* TODO [Karlee] — Baseline model & fine-tuning ticket: plain-language “confidence” implies model grounding readers can trust
                                  Model quality not yet validated against eval set
                                  Fine-tuning decision pending Karlee's baseline eval results
                                  Do not treat current output quality as production-ready until Karlee's gate is passed */}
                              <div
                                role="status"
                                className={cn(
                                  'inline-flex max-w-full rounded-full px-4 py-2.5 text-left text-sm font-semibold leading-snug shadow-sm [text-wrap:pretty]',
                                  cant &&
                                    'bg-zinc-500 text-white dark:bg-zinc-600 dark:text-white',
                                  !cant &&
                                    band === 'high' &&
                                    'bg-emerald-600 text-white dark:bg-emerald-600',
                                  !cant &&
                                    band === 'medium' &&
                                    'bg-amber-400 text-neutral-950 dark:bg-amber-400 dark:text-neutral-950',
                                  !cant &&
                                    band === 'low' &&
                                    'bg-orange-600 text-white dark:bg-orange-600'
                                )}
                              >
                                {cant
                                  ? packForAnswer.confidence.cantBadgeLabel
                                  : band === 'high'
                                    ? packForAnswer.confidence.highSentence
                                    : band === 'medium'
                                      ? packForAnswer.confidence.moderateSentence
                                      : packForAnswer.confidence.lowSentence}
                              </div>
                              {refs.length > 0 && !cant && (
                                <Collapsible className="w-full max-w-md rounded-md border border-border bg-background/80 text-left text-xs">
                                  {/* TODO [Brandi] — Data & inputs ticket: source card shows POSTed snippets + placeholder page label — not real page metadata
                                      Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed */}
                                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 font-medium hover:bg-muted/60 [&[data-state=open]>svg]:rotate-180">
                                    <span>
                                      {packForAnswer.source.expandPrefix} ·{' '}
                                      {packForAnswer.source.pagePlaceholder} ·{' '}
                                      {packForAnswer.source.tapToExpand} (
                                      {sourcePassageCountLabel(
                                        answerLocale,
                                        refs.length
                                      )}
                                      )
                                    </span>
                                    <ChevronDownIcon
                                      className="size-4 shrink-0 transition-transform"
                                      aria-hidden
                                    />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="border-t border-border px-3 pb-2 pt-1">
                                    <ol className="list-decimal space-y-3 pl-4 text-muted-foreground">
                                      {refs.map((ref, si) => {
                                        const canJump =
                                          Boolean(onJumpToSource) &&
                                          ref.charStart != null &&
                                          ref.matchLen != null
                                        return (
                                          <li key={si} className="space-y-1">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              {packForAnswer.source.exactSentence}
                                            </p>
                                            <p className="whitespace-pre-wrap text-foreground/90">
                                              {firstSentenceFromSnippet(
                                                ref.snippet
                                              )}
                                            </p>
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                              {packForAnswer.source.fullPassageSent}
                                            </p>
                                            <p className="whitespace-pre-wrap text-muted-foreground">
                                              {ref.snippet}
                                            </p>
                                            {canJump ? (
                                              <Button
                                                type="button"
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0 text-xs font-medium"
                                                onClick={() =>
                                                  onJumpToSource?.({
                                                    charStart: ref.charStart!,
                                                    matchLen: ref.matchLen!,
                                                  })
                                                }
                                              >
                                                {
                                                  packForAnswer.source
                                                    .showInOriginal
                                                }
                                              </Button>
                                            ) : onJumpToSource ? (
                                              <p className="text-[11px] text-muted-foreground">
                                                {
                                                  packForAnswer.source
                                                    .highlightUnavailable
                                                }
                                              </p>
                                            ) : (
                                              <p className="text-[11px] text-muted-foreground">
                                                {
                                                  packForAnswer.source
                                                    .useTranslatePage
                                                }
                                              </p>
                                            )}
                                          </li>
                                        )
                                      })}
                                    </ol>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </>
                          )
                        })()}
                        {(() => {
                          const lastUserTurn =
                            lastUserContentBeforeAssistantIndex(
                              displayMessages,
                              i
                            )
                          const followUps = promptsExcludingDuplicates(
                            packForAnswer.followUp,
                            {
                              inputValue: input,
                              hideIfMatchesUserTurn: lastUserTurn,
                            }
                          )
                          if (followUps.length === 0) return null
                          const isVividFollowUpRow =
                            i === followUpVividAssistantIndex
                          return (
                            <div
                              className={cn(
                                'mt-2 flex flex-wrap gap-2',
                                !isVividFollowUpRow &&
                                  'opacity-50 saturate-[0.65] transition-[opacity,filter] duration-200'
                              )}
                            >
                              {/* TODO [Zaria] — Guardrails ticket: follow-up chip wording (EN/ES) needs guardrail review
                                  v1 draft — final behavior pending Zaria's prompt rules, schema validation,
                                  input cleaning, output checking, refusal behavior, and domain restriction spec */}
                              {/* TODO [Karlee] — Baseline model & fine-tuning ticket: follow-up prompts assume the model continues helpfully from those seeds
                                  Model quality not yet validated against eval set
                                  Fine-tuning decision pending Karlee's baseline eval results
                                  Do not treat current output quality as production-ready until Karlee's gate is passed */}
                              {/* TODO [Brandi] — Data & inputs ticket: follow-up chip language follows answer heuristics — improve with chunk / doc metadata later
                                  Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed */}
                              {/* TODO [Winnie] — Evaluation & calibration ticket: Spanish follow-up strings need human + eval validation
                                  Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
                                  Multilingual accuracy target: >85% per language — EN + ES only for V1 */}
                              {followUps.map((label) => (
                                <Button
                                  key={label}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => setInput(label)}
                                >
                                  {label}
                                </Button>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                </div>
              )
            })}

              <div ref={bottomRef} />
            </div>

            {/* TODO [Winnie] — Evaluation & calibration ticket: hidden calibration / eval UI — restore after LangSmith + 50 Q&A gate
                Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
                Multilingual accuracy target: >85% per language — EN + ES only for V1 */}
            {/* TODO [Brandi] — Data & inputs ticket: calibration outputs depend on stable chunking — meaningless until pipeline is reliable
                Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed */}

            {error && (
              <Alert variant="destructive">
                {/* TODO [Winnie] — Evaluation & calibration ticket: localized error strings need human review + eval alignment
                    Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
                    Multilingual accuracy target: >85% per language — EN + ES only for V1 */}
                <AlertTitle>{askPromptPack.chrome.errorAlertTitle}</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <span>{error}</span>
                  <div className="flex flex-wrap gap-2">
                    {isSessionEndedAskError(error) ? (
                      <Button asChild variant="secondary" size="sm" className="w-fit">
                        <Link href="/">
                          {
                            ASK_ERROR_COPY[errorChromeLocale(error)].goToUpload
                          }
                        </Link>
                      </Button>
                    ) : null}
                    {lastQuestionForRetryRef.current &&
                    !isSessionEndedAskError(error) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-fit"
                        onClick={() => {
                          setError(null)
                          void runAsk(lastQuestionForRetryRef.current!)
                        }}
                      >
                        {ASK_ERROR_COPY[errorChromeLocale(error)].tryAgain}
                      </Button>
                    ) : null}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Input
                id={ASK_QUESTION_INPUT_ID}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={askPromptPack.inputPlaceholder}
                disabled={
                  isLoading ||
                  !privacyAcknowledged ||
                  !privacyHydrated ||
                  ragChunkStatus !== 'ready' ||
                  Boolean(chatHistory.error)
                }
                aria-label={askPromptPack.inputAriaLabel}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={
                  isLoading ||
                  !input.trim() ||
                  !privacyAcknowledged ||
                  !privacyHydrated ||
                  ragChunkStatus !== 'ready' ||
                  Boolean(chatHistory.error)
                }
                className="shrink-0"
              >
                {isLoading ? (
                  <Spinner className="size-4" aria-hidden="true" />
                ) : (
                  askPromptPack.sendButton
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
