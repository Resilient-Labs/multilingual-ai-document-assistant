'use client'

/**
 * AskTab — browser-side Q&A over the current document.
 *
 * **[Jasmin] — Team 1 UX ticket:** EN / ES / VI chrome, locale resolution, streaming states,
 * trust pill + source cards, RAG fallback behavior, teammate attribution comments in this file.
 * **Team internal readiness** (env, smoke, CI): `docs/ask-team-readiness.md` — run `npm run test:ask`.
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
 *    (draft overlap bands) — see `lib/askConfidenceBands.ts`; calibration accordion removed from UI.
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
  askTrustPillClassName,
  computeAskConfidenceBand,
  inferChipLocaleFromText,
} from '@/lib/askConfidenceBands'
import {
  detectAnswerLanguage,
  looksLikeEnglishQuestion,
} from '@/lib/askDetectAnswerLanguage'
import { useErrorPopup } from '@/hooks/useErrorPopup'

/**
 * [Zaria] — Guardrails ticket: **all** user-facing strings in `ASK_PROMPT_PACK` (EN + ES + VI) —
 * privacy modal, disclosures, suggested / follow-up chips, confidence copy, “not found” callout,
 * professional CTA, errors. Server-side rules live in `lib/askGuardrails.ts` + `buildSystemPrompt` in `app/api/ask/route.ts`.
 */
// [Karlee] — V1: baseline Llama 3.1 8B + RAG + prompts (no fine-tuning per team, Apr 2026).
// [Team 1 eval] — ES/VI copy should be reviewed on the gold Q&A set (`docs/evaluations/ask-ship-checklist.md`).

/** Suggested + follow-up chip copy by UI locale (aligned with document / session language). */
const ASK_PROMPT_PACK = {
  en: {
    chrome: {
      cardTitle: 'Ask about this document',
      assistantStreaming: 'Looking through your document…',
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
        'Your question and selected document text are sent to our AI provider (Hugging Face) to generate an answer. We do not store your document on the server for this step. For sensitive topics (legal, medical, immigration), this tool does not replace a professional — see each answer’s reminders.',
      privacyModalOk: 'OK — I understand',
      privacyBannerTitle: 'Privacy',
      privacyBannerBody:
        'Review how your data is used before you ask a question.',
      privacyBannerButton: 'Open privacy notice',
      chatHistoryErrorTitle: 'Could not load chat history',
      chatHistoryErrorFallback: 'Unable to load chat history.',
      chatHistoryErrorRefresh: 'Refresh page',
      errorAlertTitle: 'Error',
      noAnswerReturned: 'No answer was returned.',
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
      assistantStreaming: 'Revisando su documento…',
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
        'Su pregunta y el texto del documento seleccionado se envían a nuestro proveedor de IA (Hugging Face) para generar una respuesta. No guardamos su documento en el servidor en este paso. Para temas sensibles (legal, médico, inmigración), esta herramienta no sustituye a un profesional: revise los recordatorios de cada respuesta.',
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
      noAnswerReturned: 'No se recibió ninguna respuesta.',
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
  vi: {
    chrome: {
      cardTitle: 'Hỏi về tài liệu này',
      assistantStreaming: 'Đang xem qua tài liệu của bạn…',
      preparingChunks:
        'Đang chuẩn bị tài liệu để hỏi (đang kiểm tra các đoạn đã lưu)…',
      loadingHistory: 'Đang tải lịch sử…',
      loading: 'Đang tải…',
      chatThreadEmpty: 'Hãy đặt câu hỏi về tài liệu phía trên.',
      ragEmptyTitle: 'Chưa có tài liệu để tìm',
      ragEmptyLead:
        'Chúng tôi không thấy các đoạn văn bản của tài liệu này trong cơ sở dữ liệu trên trình duyệt (EntityDB). Thường là do chưa xử lý xong hoặc chưa tải tệp từ thiết bị này. Vui lòng vào tab Tải lên, đợi xử lý xong rồi mở lại phần Hỏi.',
      ragEmptyEx1: 'Ví dụ: «Tôi có những quyền gì theo thỏa thuận này?»',
      ragEmptyEx2: 'Ví dụ: «Có hạn chót nào tôi cần làm không?»',
      ragEmptyEx3: 'Ví dụ: «Thông báo này yêu cầu tôi làm gì?»',
      goToUploadTab: 'Đến tab Tải lên',
      privacyModalTitle: 'Câu trả lời của bạn được tạo ra thế nào',
      privacyModalBody:
        'Câu hỏi và đoạn văn bản tài liệu bạn chọn được gửi tới nhà cung cấp AI (Hugging Face) để tạo câu trả lời. Chúng tôi không lưu tài liệu của bạn trên máy chủ ở bước này. Với chủ đề nhạy cảm (pháp lý, y tế, nhập cư), công cụ này không thay thế chuyên gia — xem nhắc nhở dưới mỗi câu trả lời.',
      privacyModalOk: 'Tôi đã hiểu',
      privacyBannerTitle: 'Quyền riêng tư',
      privacyBannerBody:
        'Xem cách dữ liệu được sử dụng trước khi bạn đặt câu hỏi.',
      privacyBannerButton: 'Mở thông báo quyền riêng tư',
      chatHistoryErrorTitle: 'Không tải được lịch sử trò chuyện',
      chatHistoryErrorFallback: 'Không tải được lịch sử trò chuyện.',
      chatHistoryErrorRefresh: 'Tải lại trang',
      errorAlertTitle: 'Lỗi',
      noAnswerReturned: 'Không nhận được câu trả lời.',
    },
    inputPlaceholder: 'Đặt câu hỏi…',
    sendButton: 'Gửi',
    inputAriaLabel: 'Ô nhập câu hỏi',
    suggestedSection: 'Thử hỏi:',
    suggested: [
      'Tôi có đủ điều kiện nhận quyền lợi này không?',
      'Tôi cần những giấy tờ gì để nộp đơn?',
      'Hạn chót nộp hồ sơ là khi nào?',
      'Tôi có những quyền gì theo thỏa thuận này?',
    ],
    followUp: [
      'Tôi nên làm gì tiếp theo?',
      'Có hạn chót nào tôi cần biết không?',
      'Bạn có thể giải thích đơn giản hơn không?',
    ],
    source: {
      pagePlaceholder: 'Trang chưa có',
      expandPrefix: 'Nguồn',
      tapToExpand: 'chạm để mở rộng',
      exactSentence: 'Câu khớp (đã truy xuất)',
      fullPassageSent: 'Đoạn đầy đủ đã gửi cho mô hình:',
      showInOriginal: 'Hiện trong tài liệu gốc',
      highlightUnavailable:
        'Không thể làm nổi bật — đoạn có thể bị cắt hoặc không khớp nguyên văn trong tài liệu.',
      useTranslatePage:
        'Dùng trang dịch của tài liệu này để nhảy tới và làm nổi bật văn bản gốc.',
    },
    confidence: {
      cantBadgeLabel: 'Không xác định được',
      highSentence: 'Chúng tôi tìm thấy câu trả lời rõ ràng trong tài liệu',
      moderateSentence:
        'Chúng tôi tìm thấy câu trả lời một phần — vui lòng đối chiếu tài liệu',
      lowSentence:
        'Chúng tôi không chắc về câu trả lời này — vui lòng xem trực tiếp tài liệu',
    },
    cantCallout: {
      title: 'Không thấy rõ trong tài liệu',
      body: 'Chúng tôi không tìm thấy câu trả lời rõ trong tài liệu. Hãy thử đặt lại câu hỏi hoặc tham vấn chuyên gia có trình độ.',
      consultButton: 'Tham vấn chuyên gia',
    },
  },
} as const

/** English follow-up chip labels — when the doc/session is Spanish, we still treat these as “Spanish UX” turns. */
const ASK_EN_FOLLOW_UP_CHIP_SET = new Set<string>(
  ASK_PROMPT_PACK.en.followUp as unknown as string[]
)

/** Vietnamese follow-up chips — same pattern as English chips on a Vietnamese session ([Jasmin] UX, Apr 2026). */
const ASK_VI_FOLLOW_UP_CHIP_SET = new Set<string>(
  ASK_PROMPT_PACK.vi.followUp as unknown as string[]
)

type AskChipLocale = keyof typeof ASK_PROMPT_PACK

function documentPageIsSpanish(documentLanguage: string | undefined): boolean {
  return (documentLanguage?.trim().toLowerCase() ?? '').startsWith('es')
}

function documentPageIsVietnamese(documentLanguage: string | undefined): boolean {
  return (documentLanguage?.trim().toLowerCase() ?? '').startsWith('vi')
}

/**
 * API `answerLanguage`: doc/translate locale + static follow-up chip in another surface language
 * ⇒ still request the session language from the model ([Jasmin] contract; [Brandi] chunk language may still differ).
 *
 * Contributors: [Jasmin] — thread snapshot + chrome reconciliation for short ambiguous lines;
 * [Karlee] — `/api/ask` + `buildSystemPrompt` output-language rule; [Brandi] — `messagesSnapshot`
 * must stay in sync with client RAG turns so chrome and POST body agree.
 */
function answerLanguageForAskApi(
  question: string,
  documentLanguage: string | undefined,
  translationTargetLang: string | undefined,
  messagesSnapshot: Array<{ role: string; content: string }>,
  fullText: string
): 'es' | 'en' | 'vi' {
  const q = question.trim()
  const tl = translationTargetLang?.trim().toLowerCase() ?? ''
  const targetVi = tl.startsWith('vi')
  if (
    (documentPageIsVietnamese(documentLanguage) || targetVi) &&
    ASK_EN_FOLLOW_UP_CHIP_SET.has(q)
  ) {
    return 'vi'
  }
  if (
    (documentPageIsVietnamese(documentLanguage) || targetVi) &&
    ASK_VI_FOLLOW_UP_CHIP_SET.has(q)
  ) {
    return 'vi'
  }
  const targetEs = tl.startsWith('es')
  if (
    (documentPageIsSpanish(documentLanguage) || targetEs) &&
    ASK_EN_FOLLOW_UP_CHIP_SET.has(q)
  ) {
    return 'es'
  }
  const detected = detectAnswerLanguage(
    question,
    documentLanguage,
    translationTargetLang
  )
  const thread = [...messagesSnapshot, { role: 'user' as const, content: q }]
  const chrome = resolveAskChromeLocale(
    thread,
    documentLanguage,
    fullText,
    translationTargetLang
  )
  // [Jasmin] — align POST `answerLanguage` with per-turn chrome when the line is short/ambiguous EN;
  // [Karlee] — model follows system prompt language; mismatch here caused EN answers on ES shell.
  if (
    detected === 'en' &&
    (chrome === 'es' || chrome === 'vi') &&
    q.length <= 48
  ) {
    return chrome
  }
  return detected
}

// [Team 1 eval] — Locale heuristics should be checked on gold Q&A rows (EN/ES/VI).
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
  if (fromAnswer === 'vi') return 'vi'
  if (fromAnswer === 'es') return 'es'

  const q = pairedUserQuestion?.trim() ?? ''
  const userLang = q
    ? detectAnswerLanguage(q, documentLanguage, translationTargetLang)
    : 'en'

  const tl = translationTargetLang?.trim().toLowerCase() ?? ''
  const targetVi = tl.startsWith('vi')
  const targetEs = tl.startsWith('es')
  if (
    (documentPageIsVietnamese(documentLanguage) || targetVi) &&
    q &&
    (ASK_EN_FOLLOW_UP_CHIP_SET.has(q) || ASK_VI_FOLLOW_UP_CHIP_SET.has(q))
  ) {
    return 'vi'
  }
  if (
    (documentPageIsSpanish(documentLanguage) || targetEs) &&
    q &&
    ASK_EN_FOLLOW_UP_CHIP_SET.has(q)
  ) {
    return 'es'
  }

  if (userLang === 'vi') return 'vi'
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
  if (raw.startsWith('vi')) return 'vi'
  if (raw.startsWith('en')) return 'en'
  return inferChipLocaleFromText(fullText)
}

function sourcePassageCountLabel(locale: AskChipLocale, count: number): string {
  if (locale === 'es') {
    if (count === 1) return '1 pasaje'
    return `${count} pasajes`
  }
  if (locale === 'vi') {
    if (count === 1) return '1 đoạn'
    return `${count} đoạn`
  }
  if (count === 1) return '1 passage'
  return `${count} passages`
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
    if (tgt.startsWith('vi')) return 'vi'
    if (tgt.startsWith('es')) return 'es'
    return resolveAskChipLocale(documentLanguage, fullText)
  }

  let fromUser = detectAnswerLanguage(last, documentLanguage, translationTargetLang)
  const assistant = lastAssistantMessageContent(messages)?.trim() ?? ''
  if (
    assistant &&
    last.length <= 200 &&
    fromUser === 'en' &&
    !looksLikeEnglishQuestion(last) &&
    detectAnswerLanguage(assistant.slice(0, 6000), documentLanguage, translationTargetLang) ===
    'es'
  ) {
    fromUser = 'es'
  }

  if (fromUser === 'vi') return 'vi'
  if (fromUser === 'es') return 'es'
  return 'en'
}

/**
 * When the translate session target is ES or VI, nudge ambiguous **short** English (e.g. follow-up chips)
 * to session chrome — but **do not** override a clear English *typed* question (not the static EN chip
 * labels on a VI/ES session — those still floor to session chrome) ([Jasmin] v1 + Apr 2026).
 */
function applyTranslationTargetChromeFloor(
  locale: AskChipLocale,
  translationTargetLang?: string,
  opts?: { lastUserContent?: string | null; documentLanguage?: string }
): AskChipLocale {
  const last = opts?.lastUserContent?.trim() ?? ''
  const doc = opts?.documentLanguage
  const tl = translationTargetLang?.trim().toLowerCase() ?? ''
  const targetVi = tl.startsWith('vi')
  const targetEs = tl.startsWith('es')
  const isStaticEnFollowUpChip =
    ASK_EN_FOLLOW_UP_CHIP_SET.has(last) &&
    ((documentPageIsVietnamese(doc) || targetVi) ||
      (documentPageIsSpanish(doc) || targetEs))

  if (
    last.length >= 2 &&
    looksLikeEnglishQuestion(last) &&
    !isStaticEnFollowUpChip
  ) {
    return locale
  }
  if (tl.startsWith('es') && locale === 'en') return 'es'
  if (tl.startsWith('vi') && locale === 'en') return 'vi'
  return locale
}

/**
 * Locale for **card chrome** (title, placeholders, send, top chips) — must match the latest turn
 * **and** the translate `translationTargetLang` when set ([Jasmin] v1).
 */
function resolveAskChromeLocale(
  messages: Array<{ role: string; content: string }>,
  documentLanguage: string | undefined,
  fullText: string,
  translationTargetLang?: string
): AskChipLocale {
  const n = messages.length
  if (n === 0) {
    return applyTranslationTargetChromeFloor(
      resolveAskUiLocale(
        messages,
        documentLanguage,
        fullText,
        translationTargetLang
      ),
      translationTargetLang,
      { documentLanguage }
    )
  }

  const last = messages[n - 1]

  if (
    last.role === 'assistant' &&
    !last.content.trim() &&
    n >= 2 &&
    messages[n - 2].role === 'user' &&
    messages[n - 2].content.trim()
  ) {
    const lang = detectAnswerLanguage(
      messages[n - 2].content,
      documentLanguage,
      translationTargetLang
    )
    const chip: AskChipLocale =
      lang === 'vi' ? 'vi' : lang === 'es' ? 'es' : 'en'
    return applyTranslationTargetChromeFloor(chip, translationTargetLang, {
      lastUserContent: messages[n - 2].content,
      documentLanguage,
    })
  }

  if (last.role === 'user' && last.content.trim()) {
    const lang = detectAnswerLanguage(
      last.content,
      documentLanguage,
      translationTargetLang
    )
    let chip: AskChipLocale =
      lang === 'vi' ? 'vi' : lang === 'es' ? 'es' : 'en'
    // Short follow-up after a non-English assistant: keep ES/VI chrome when the line alone looks “en” ([Jasmin] Apr 2026).
    if (chip === 'en' && n >= 2) {
      const prev = messages[n - 2]
      const trimmed = last.content.trim()
      if (prev.role === 'assistant' && prev.content.trim() && trimmed.length <= 40) {
        const priorAns = inferChipLocaleFromText(prev.content.slice(0, 4000))
        const clearlyEnglish =
          looksLikeEnglishQuestion(trimmed) &&
          !/\b(gracias|por favor|hola|chao|chau|vale|bueno|xin|cảm ơn|vâng|dạ|cám ơn)\b/i.test(
            trimmed.toLowerCase()
          )
        if (priorAns === 'es' && !clearlyEnglish) chip = 'es'
        else if (priorAns === 'vi' && !clearlyEnglish) chip = 'vi'
      }
    }
    return applyTranslationTargetChromeFloor(chip, translationTargetLang, {
      lastUserContent: last.content,
      documentLanguage,
    })
  }

  if (last.role === 'assistant' && last.content.trim()) {
    const idx = n - 1
    const paired = lastUserContentBeforeAssistantIndex(messages, idx)
    const pairedTrim = paired?.trim() ?? ''
    const userLang = pairedTrim
      ? detectAnswerLanguage(pairedTrim, documentLanguage, translationTargetLang)
      : 'en'
    const fromAnswer = inferUiLocaleFromAnswerText(
      last.content,
      paired,
      documentLanguage,
      translationTargetLang
    )
    /**
     * Chrome for this assistant row follows the **paired user question**, not the model’s surface
     * language — EN question + ES answer still shows EN pills/callout/source labels ([Jasmin] Apr 2026).
     */
    const inferred: AskChipLocale = pairedTrim
      ? userLang === 'vi'
        ? 'vi'
        : userLang === 'es'
          ? 'es'
          : 'en'
      : fromAnswer
    return applyTranslationTargetChromeFloor(
      inferred,
      translationTargetLang,
      { lastUserContent: pairedTrim || null, documentLanguage }
    )
  }

  return applyTranslationTargetChromeFloor(
    resolveAskUiLocale(
      messages,
      documentLanguage,
      fullText,
      translationTargetLang
    ),
    translationTargetLang,
    {
      lastUserContent: lastUserMessageContent(messages),
      documentLanguage,
    }
  )
}

// [Zaria] — Guardrails: error / offline messaging — pair with `lib/askGuardrails.ts`. [Team 1] — ES/VI tone on eval set.
const ASK_ERROR_COPY = {
  en: {
    offline:
      'You appear to be offline. Please check your connection and try again.',
    modelTimeout: 'This is taking longer than expected. Please try again.',
    modelProviderBusy:
      'The answer service is busy or rate-limited. Wait a moment and try again, or check your Hugging Face account and plan limits.',
    modelFailure:
      'Something went wrong answering your question. Please try again.',
    modelEmptyReply:
      'The model did not return any text. Please try again.',
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
    modelProviderBusy:
      'El servicio de respuestas está ocupado o con límite de uso. Espere un momento e intente de nuevo, o revise su cuenta y plan de Hugging Face.',
    modelFailure: 'Algo salió mal. Por favor intente de nuevo.',
    modelEmptyReply:
      'El modelo no devolvió ningún texto. Por favor intente de nuevo.',
    sessionEnded:
      'Su sesión ha terminado. Regrese a la pestaña de carga para continuar.',
    tryAgain: 'Intentar de nuevo',
    goToUpload: 'Ir a la pestaña de carga',
  },
  vi: {
    offline:
      'Có vẻ bạn đang ngoại tuyến. Vui lòng kiểm tra kết nối và thử lại.',
    modelTimeout: 'Đang mất nhiều thời gian hơn dự kiến. Vui lòng thử lại.',
    modelProviderBusy:
      'Dịch vụ trả lời đang bận hoặc bị giới hạn tần suất. Hãy đợi một lát rồi thử lại, hoặc kiểm tra tài khoản và gói Hugging Face của bạn.',
    modelFailure: 'Đã xảy ra lỗi khi trả lời. Vui lòng thử lại.',
    modelEmptyReply:
      'Mô hình không trả về nội dung. Vui lòng thử lại.',
    sessionEnded:
      'Phiên của bạn đã kết thúc. Vui lòng quay lại tab Tải lên để tiếp tục.',
    tryAgain: 'Thử lại',
    goToUpload: 'Đến tab Tải lên',
  },
} as const

function askErrorLocale(
  question: string,
  documentLanguage: string | undefined,
  translationTargetLang?: string
): AskChipLocale {
  const lang = detectAnswerLanguage(
    question,
    documentLanguage,
    translationTargetLang
  )
  if (lang === 'vi') return 'vi'
  if (lang === 'es') return 'es'
  return 'en'
}

/**
 * Map HF / AI SDK failures to a user-facing line (EN / ES / VI). [Karlee] — inference path;
 * [Jasmin] — client surfacing; [Team 1 eval] — tone on ES/VI.
 */
function askProviderOrNetworkMessage(raw: string): 'timeout' | 'quota' | 'generic' {
  const m = raw.toLowerCase()
  if (
    /abort|timeout|timed out|network|failed to fetch|load failed|querychunks timeout|etimedout|econnreset/i.test(
      m
    )
  ) {
    return 'timeout'
  }
  if (
    /\b402\b|\b429\b|quota|rate limit|too many requests|billing|payment|exceeded|capacity|overload/i.test(
      m
    )
  ) {
    return 'quota'
  }
  return 'generic'
}

// [Brandi] — `SNIPPET_MAX` caps snippet size on source cards (sentence boundaries are future work).
const SNIPPET_MAX = 450

/** Max chars of full document used as overlap context when RAG used whole-doc fallback ([Jasmin] + [Brandi] heuristic fix, Apr 2026). */
const ASK_OVERLAP_FULLTEXT_MAX = 24_000

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

/** “Exact sentence” for expanded source — approximates from truncated chunk ([Brandi] data path). */
function firstSentenceFromSnippet(snippet: string): string {
  const t = snippet.trim()
  if (!t) return ''
  const m = t.match(/^[^.!?…]+[.!?…]?/)
  return (m ? m[0] : t.slice(0, 240)).trim()
}

function inferLegacyAskRagMode(
  msg: {
    sourceRefs?: AskSourceRef[]
    sourceChunks?: string[]
    askRagMode?: 'indexed' | 'fulltext_fallback'
  },
  fullText: string
): 'indexed' | 'fulltext_fallback' {
  if (msg.askRagMode) return msg.askRagMode
  const refs = sourcesForDisplay(msg, fullText)
  if (refs.length === 0) return 'fulltext_fallback'
  if (refs.length >= 2) return 'indexed'
  const r0 = refs[0]
  if (r0.chunkId) return 'indexed'
  const head = r0.snippet.replace(/\u2026$|…$/, '').trim()
  if (head.length >= 320 && fullText.trim().startsWith(head))
    return 'fulltext_fallback'
  return 'indexed'
}

/**
 * Text window for lexical overlap / trust pill. Indexed RAG uses posted snippets; whole-doc
 * fallback uses a large `fullText` slice so the pill is not stuck on a 450-char head ([Brandi] issue; [Jasmin] fix).
 */
function contextForOverlap(
  msg: {
    sourceRefs?: AskSourceRef[]
    sourceChunks?: string[]
    askRagMode?: 'indexed' | 'fulltext_fallback'
  },
  fullText: string
): string {
  const mode = inferLegacyAskRagMode(msg, fullText)
  if (mode === 'fulltext_fallback') {
    return fullText.slice(
      0,
      Math.min(Math.max(0, fullText.length), ASK_OVERLAP_FULLTEXT_MAX)
    )
  }
  const refs = sourcesForDisplay(msg, fullText)
  if (refs.length > 0) return refs.map((r) => r.snippet).join('\n')
  return fullText.slice(0, 8000)
}

interface PendingMessage {
  role: 'user' | 'assistant'
  content: string
  /** Structured RAG sources for this turn (persisted on assistant). */
  sourceRefs?: AskSourceRef[]
  /** See `ChatMessage.askRagMode` — set on assistant rows for overlap + cant-determine gating. */
  askRagMode?: 'indexed' | 'fulltext_fallback'
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
   * Translate flow: session `targetLang` (e.g. `es` / `vi`). Drives **chrome floor**: if the user
   * types English but the session target is Spanish or Vietnamese, card title / input / send stay
   * ES or VI so the shell matches the translate language ([Jasmin] v1).
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
  const { showError } = useErrorPopup()
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
    const locale = resolveAskChromeLocale(
      displayMessages,
      documentLanguage,
      fullText,
      translationTargetLang
    )
    return {
      askPromptPack: ASK_PROMPT_PACK[locale],
    }
  }, [displayMessages, documentLanguage, fullText, translationTargetLang])

  useEffect(() => {
    if (!chatHistory.error) return

    showError(
      askPromptPack.chrome.chatHistoryErrorTitle,
      chatHistory.error.trim()
        ? chatHistory.error
        : askPromptPack.chrome.chatHistoryErrorFallback
    )
  }, [
    askPromptPack.chrome.chatHistoryErrorFallback,
    askPromptPack.chrome.chatHistoryErrorTitle,
    chatHistory.error,
    showError,
  ])

  useEffect(() => {
    if (!error) return

    showError(askPromptPack.chrome.errorAlertTitle, error)
  }, [askPromptPack.chrome.errorAlertTitle, error, showError])

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
  // [Brandi] — `countRagChunksForDoc` bridges upload vs Ask until navigation/indexing is instant.
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
        const eloc = askErrorLocale(
          question,
          documentLanguage,
          translationTargetLang
        )
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
      // [Brandi] — Indexed chunks when hits exist; [Jasmin] — `askRagMode` records fallback for overlap / cant-determine gating.
      let ragParts: Array<{ text: string; chunkId?: string }>
      let usedIndexedChunks = false
      try {
        const results = await Promise.race([
          queryChunks(question, { limit: 5 }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('queryChunks timeout')), 3000)
          ),
        ])
        const scopedResults = results.filter((r) => r.docId === docId)
        usedIndexedChunks = scopedResults.length > 0
        ragParts =
          scopedResults.length > 0
            ? scopedResults.map((r) => ({
              text: r.text,
              ...(r.chunkId ? { chunkId: r.chunkId } : {}),
            }))
            : [{ text: fullText }]
      } catch {
        ragParts = [{ text: fullText }]
        usedIndexedChunks = false
      }

      const askRagMode = usedIndexedChunks ? 'indexed' : 'fulltext_fallback'
      const chunks = ragParts.map((p) => p.text)
      const sourceRefs = buildSourceRefs(ragParts, fullText)
      const sourceSnippets = sourceRefs.map((r) => r.snippet)
      setPendingMessages([
        { role: 'user', content: question },
        { role: 'assistant', content: '', sourceRefs, askRagMode },
      ])

      try {
        // [Karlee] — Baseline Llama 3.1 8B + prompts (no fine-tuning, Apr 2026).
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            chunks,
            answerLanguage: answerLanguageForAskApi(
              question,
              documentLanguage,
              translationTargetLang,
              chatHistory.messages,
              fullText
            ),
          }),
        })

        if (!res.ok) {
          const eloc = askErrorLocale(
            question,
            documentLanguage,
            translationTargetLang
          )
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
          if (res.status === 402 || res.status === 429) {
            setError(ASK_ERROR_COPY[eloc].modelProviderBusy)
            setPendingMessages([])
            return
          }
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: unknown
          }
          const serverMsg =
            typeof errBody.error === 'string' ? errBody.error.trim() : ''
          if (res.status === 503 && serverMsg) {
            setError(serverMsg)
            setPendingMessages([])
            return
          }
          if (
            serverMsg &&
            (res.status === 422 || res.status === 400 || res.status === 413)
          ) {
            // [Zaria] — guardrails / policy errors: show server text (crisis routing, off-topic, limits).
            setError(serverMsg)
            setPendingMessages([])
            return
          }
          if (
            serverMsg &&
            res.status >= 500 &&
            res.status < 600 &&
            serverMsg.length <= 280
          ) {
            setError(serverMsg)
            setPendingMessages([])
            return
          }
          setError(ASK_ERROR_COPY[eloc].modelFailure)
          setPendingMessages([])
          return
        }

        if (!res.body) {
          const eloc = askErrorLocale(
            question,
            documentLanguage,
            translationTargetLang
          )
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

        // Provider failures (e.g. HF 402 / quota) arrive as stream `error` chunks, not HTTP 4xx.
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
                askRagMode,
              },
            ])
          }
        }

        if (!finalText.trim()) {
          const eloc = askErrorLocale(
            question,
            documentLanguage,
            translationTargetLang
          )
          setError(ASK_ERROR_COPY[eloc].modelEmptyReply)
          setPendingMessages([])
          return
        }

        await chatHistory.addMessage('user', question)
        await chatHistory.addMessage('assistant', finalText, {
          sourceRefs,
          sourceChunks: sourceSnippets,
          askRagMode,
        })
        setPendingMessages([])
      } catch (err) {
        const eloc = askErrorLocale(
          question,
          documentLanguage,
          translationTargetLang
        )
        const msg = err instanceof Error ? err.message : String(err)
        if (process.env.NODE_ENV === 'development') {
          /* eslint-disable no-console -- [Jasmin] dev-only Ask stream / HF diagnostics for [Karlee] model path */
          console.warn('[ask-tab] ask failed:', msg)
          /* eslint-enable no-console */
        }
        if (
          /\b401\b|\b403\b/i.test(msg) ||
          /unauthorized|forbidden/i.test(msg.toLowerCase())
        ) {
          setError(ASK_ERROR_COPY[eloc].sessionEnded)
        } else {
          const kind = askProviderOrNetworkMessage(msg)
          if (kind === 'timeout') {
            setError(ASK_ERROR_COPY[eloc].modelTimeout)
          } else if (kind === 'quota') {
            setError(ASK_ERROR_COPY[eloc].modelProviderBusy)
          } else {
            setError(ASK_ERROR_COPY[eloc].modelFailure)
          }
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
    [
      fullText,
      docId,
      documentLanguage,
      translationTargetLang,
      chatHistory.addMessage,
      // [Jasmin] — list `messages`: `addMessage` is stable from `useChatHistory`; omitting messages
      // stale-closed `answerLanguageForAskApi` (wrong language on turn 2+).
      chatHistory.messages,
    ]
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

      <CardContent className="flex min-w-0 flex-col gap-4">
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
                {/* [Zaria] Guardrails: privacy modal — ASK_PROMPT_PACK.chrome.privacyModal* */}
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
                  {/* [Zaria] — suggested chips. [Brandi] — niche prompts when chunk metadata exists. [Team 1 eval] — EN/ES/VI review. */}
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
                  /** Per-turn chrome pack — trust pill / sources / chips match title & input for that point in the thread ([Jasmin] Apr 2026). */
                  const chromeLocaleAtTurn = resolveAskChromeLocale(
                    displayMessages.slice(0, i + 1),
                    documentLanguage,
                    fullText,
                    translationTargetLang
                  )
                  const packForChromeAtTurn = ASK_PROMPT_PACK[chromeLocaleAtTurn]
                  const overlapCtx = isAssistant
                    ? contextForOverlap(msg, fullText)
                    : ''
                  const overlapBand =
                    isAssistant && msg.content.trim().length > 0
                      ? computeAskConfidenceBand(msg.content, overlapCtx)
                      : 'low'
                  const wordingCant =
                    isAssistant &&
                    msg.content.trim().length > 0 &&
                    answerLooksLikeCantDetermine(msg.content)
                  /** Pill must match “can’t find” wording; overlap alone can contradict ([Jasmin] Apr 2026). */
                  const pillBand = wordingCant ? 'cant_determine' : overlapBand
                  const showCantCallout =
                    wordingCant && overlapBand !== 'high'
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
                            {askPromptPack.chrome.assistantStreaming}
                          </span>
                        ) : !msg.content.trim() && isAssistant ? (
                          <span className="text-muted-foreground">
                            {packForChromeAtTurn.chrome.noAnswerReturned}
                          </span>
                        ) : (
                          msg.content
                        )}
                      </div>
                      {isAssistant && assistantPostStreamReady && (
                        <div className="flex w-full min-w-0 max-w-full flex-col gap-2 sm:max-w-[min(100%,36rem)]">
                          {/* [Brandi] — “Not found” regex + [Jasmin] — suppress when overlap band is `high` (bad chunks / full-doc fallback used to skew overlap). */}
                          {showCantCallout && (
                            <Alert className="border-muted-foreground/40 bg-muted/60">
                              {/* [Zaria] Guardrails: “not found” + CTA — ASK_PROMPT_PACK.*.cantCallout */}
                              <AlertTitle>
                                {packForChromeAtTurn.cantCallout.title}
                              </AlertTitle>
                              <AlertDescription className="flex flex-col gap-2">
                                <span>{packForChromeAtTurn.cantCallout.body}</span>
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
                                    {packForChromeAtTurn.cantCallout.consultButton}
                                  </a>
                                </Button>
                              </AlertDescription>
                            </Alert>
                          )}
                          {(() => {
                            const refs = sourcesForDisplay(msg, fullText)
                            const cantPill = pillBand === 'cant_determine'
                            return (
                              <>
                                {/* [Team 1 eval] — Trust pill uses `lib/askConfidenceBands.ts` (same constants as `/api/ask` logs). [Karlee] — baseline model only. */}
                                <div
                                  role="status"
                                  className={cn(
                                    'inline-flex max-w-full rounded-full px-4 py-2.5 text-left text-sm font-semibold leading-snug shadow-sm [text-wrap:pretty]',
                                    askTrustPillClassName(pillBand)
                                  )}
                                >
                                  {cantPill
                                    ? packForChromeAtTurn.confidence.cantBadgeLabel
                                    : pillBand === 'high'
                                      ? packForChromeAtTurn.confidence.highSentence
                                      : pillBand === 'medium'
                                        ? packForChromeAtTurn.confidence.moderateSentence
                                        : packForChromeAtTurn.confidence.lowSentence}
                                </div>
                                {refs.length > 0 && !cantPill && (
                                  <Collapsible className="w-full max-w-md rounded-md border border-border bg-background/80 text-left text-xs">
                                    {/* [Brandi] — snippets are what was POSTed; page labels are placeholders until doc layout metadata exists. */}
                                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 font-medium hover:bg-muted/60 [&[data-state=open]>svg]:rotate-180">
                                      <span>
                                        {packForChromeAtTurn.source.expandPrefix} ·{' '}
                                        {packForChromeAtTurn.source.pagePlaceholder} ·{' '}
                                        {packForChromeAtTurn.source.tapToExpand} (
                                        {sourcePassageCountLabel(
                                          chromeLocaleAtTurn,
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
                                                {packForChromeAtTurn.source.exactSentence}
                                              </p>
                                              <p className="whitespace-pre-wrap text-foreground/90">
                                                {firstSentenceFromSnippet(
                                                  ref.snippet
                                                )}
                                              </p>
                                              <p className="mt-1 text-[11px] text-muted-foreground">
                                                {packForChromeAtTurn.source.fullPassageSent}
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
                                                    packForChromeAtTurn.source
                                                      .showInOriginal
                                                  }
                                                </Button>
                                              ) : onJumpToSource ? (
                                                <p className="text-[11px] text-muted-foreground">
                                                  {
                                                    packForChromeAtTurn.source
                                                      .highlightUnavailable
                                                  }
                                                </p>
                                              ) : (
                                                <p className="text-[11px] text-muted-foreground">
                                                  {
                                                    packForChromeAtTurn.source
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
                              packForChromeAtTurn.followUp,
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
                                {/* [Zaria] — follow-up chips; locale from per-turn `resolveAskChromeLocale` (matches card chrome). [Karlee] — model continuation quality. */}
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
