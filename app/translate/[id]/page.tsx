'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon, ArrowRightIcon, Trash2Icon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ReadAloudPanel } from '@/components/features/tts/ReadAloudPanel'
import { TranslateSummary } from '@/components/features/summary/translate-summary'
import { AskTab, askPrivacyStorageKey } from '@/components/features/ask/AskTab'
import { DetectTab } from '@/components/features/detect/DetectTab'
import { useErrorPopup } from '@/hooks/useErrorPopup'
import { cn } from '@/lib/utils'
import { getSafetyLang, SAFETY_UI_STRINGS } from '@/lib/safetyI18n'
import { detectPii } from '@/lib/guardrails/pii'
import { getEntityDB } from '@/lib/entitydb'
import {
  deleteAllVectorsForDocId,
  getTranslateSessionByDocId,
  persistTranslationCache,
  readCachedTranslation,
  translateCacheIdsStorageKey,
  translationInputFingerprint,
} from '@/lib/entitydb-translate-cache'

interface TranslateSession {
  fullText: string
  filename: string
  sourceLang: string
  targetLang: string
}

const TTS_SUPPORTED_LANGS = new Set(['en', 'es', 'vi'])

const LANGUAGE_LABELS: Record<string, string> = {
  auto: 'Detected',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  tr: 'Turkish',
  vi: 'Vietnamese',
}

export default function TranslatePage() {
  const params = useParams()
  const router = useRouter()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')

  const [session, setSession] = useState<TranslateSession | null>(null)
  const [sessionMissing, setSessionMissing] = useState(false)
  const [piiBlocked, setPiiBlocked] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const originalDocTextareaRef = useRef<HTMLTextAreaElement>(null)
  const { showError } = useErrorPopup()

  const jumpToSource = useCallback(
    (range: { charStart: number; matchLen: number }) => {
      const el = originalDocTextareaRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      const start = Math.max(0, Math.min(range.charStart, el.value.length))
      const end = Math.max(
        start,
        Math.min(start + Math.max(0, range.matchLen), el.value.length)
      )
      el.setSelectionRange(start, end)
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    []
  )

  useEffect(() => {
    if (!id) return

    setSession(null)
    setSessionMissing(false)

    const raw = sessionStorage.getItem(`translate-${id}`)
    if (raw) {
      try {
        const parsed: TranslateSession = JSON.parse(raw)
        setSession(parsed)
        return
      } catch {
        setSessionMissing(true)
        return
      }
    }
    try {
      const parsed: TranslateSession = JSON.parse(raw)

      // Check for PII before proceeding (backup defense)
      const piiMatches = detectPii(parsed.fullText)
      if (piiMatches.length > 0) {
        sessionStorage.removeItem(`translate-${id}`)
        sessionStorage.removeItem('current-doc-id')
        setPiiBlocked(true)
        const piiTypes = piiMatches.map((m) => m.label).join(', ')
        showError(
          'Sensitive Information Detected',
          `This document contains sensitive information (${piiTypes}) and cannot be processed. Please upload a different document.`,
          '/'
        )
        return
      }

      setSession(parsed)
    } catch {
      setSessionMissing(true)

    let cancelled = false
    void (async () => {
      try {
        const fromIdb = await getTranslateSessionByDocId(getEntityDB(), id)
        if (cancelled) return
        if (fromIdb) {
          setSession(fromIdb)
        } else {
          setSessionMissing(true)
        }
      } catch {
        if (!cancelled) {
          setSessionMissing(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, showError])

  useEffect(() => {
    if (!session || !id) return

    let cancelled = false
    const fingerprint = translationInputFingerprint(
      session.fullText,
      session.targetLang
    )

    void (async () => {
      setTranslateLoading(true)
      setTranslateError(null)
      try {
        const cached = await readCachedTranslation(
          getEntityDB(),
          id,
          fingerprint
        )
        if (cancelled) return
        if (cached !== null) {
          setTranslatedText(cached)
          return
        }

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: session.fullText,
            targetLang: session.targetLang,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error ?? 'Translation failed')
        }

        const nextText = data.translatedText
        if (typeof nextText !== 'string') {
          throw new Error('Translation failed')
        }

        if (cancelled) return
        setTranslatedText(nextText)
        await persistTranslationCache(
          getEntityDB(),
          id,
          fingerprint,
          nextText
        )
      } catch (err) {
        if (!cancelled) {
          setTranslateError(
            err instanceof Error ? err.message : 'Translation failed'
          )
        }
      } finally {
        if (!cancelled) {
          setTranslateLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session, id])

  useEffect(() => {
    if (!sessionMissing) return
    showError(
      'Session expired',
      'No document data found. Please upload your document again.',
      '/'
    )
  }, [sessionMissing, showError])

  useEffect(() => {
    if (!translateError) return
    showError('Translation failed', translateError, '/')
  }, [showError, translateError])

  if (sessionMissing || piiBlocked) {
  const deleteDocumentFromDevice = useCallback(async () => {
    if (!id) return
    setDeleteBusy(true)
    try {
      localStorage.removeItem(translateCacheIdsStorageKey(id))
      sessionStorage.removeItem(`translate-${id}`)
      sessionStorage.removeItem(askPrivacyStorageKey(id))
      if (sessionStorage.getItem('current-doc-id') === id) {
        sessionStorage.removeItem('current-doc-id')
      }
      await deleteAllVectorsForDocId(id)
      setDeleteDialogOpen(false)
      router.push('/')
    } catch (err) {
      showError(
        'Could not delete document',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setDeleteBusy(false)
    }
  }, [id, router, showError])

  if (sessionMissing) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="w-fit gap-2"
          >
            <ArrowLeftIcon className="size-4" />
            Back to upload
          </Button>
        </div>
      </div>
    )
  }

  const sourceLangLabel = session
    ? (LANGUAGE_LABELS[session.sourceLang] ?? session.sourceLang)
    : ''
  const targetLangLabel = session
    ? (LANGUAGE_LABELS[session.targetLang] ?? session.targetLang)
    : ''

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="-ml-2 gap-2 text-muted-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>

          {session && (
            <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
              <div className="flex max-w-full items-center justify-end gap-1">
                <p className="max-w-[200px] truncate text-sm font-medium md:max-w-xs">
                  {session.filename}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete this document from this device"
                  disabled={deleteBusy}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2Icon className="size-4" aria-hidden />
                </Button>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {sourceLangLabel}
                <ArrowRightIcon className="size-3" />
                {targetLangLabel}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6">
          {/* Original document */}
          <Card className="flex w-full min-w-0 flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Original Document</CardTitle>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-4 overflow-y-auto">
              {!session ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-6" aria-label="Loading document" />
                </div>
              ) : (
                <>
                  <textarea
                    ref={originalDocTextareaRef}
                    id="ask-original-document"
                    readOnly
                    value={session.fullText}
                    className={cn(
                      'block min-h-16 min-w-0 w-full max-w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none md:text-sm dark:bg-input/30',
                      'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                      'min-h-[120px] max-h-64 resize-none overflow-y-auto',
                      'cursor-default'
                    )}
                    aria-label="Original document text"
                  />
                  {TTS_SUPPORTED_LANGS.has(session.sourceLang) && (
                    <ReadAloudPanel
                      text={session.fullText}
                      language={session.sourceLang}
                      labelSuffix={sourceLangLabel}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Translation */}
          <Card className="flex w-full min-w-0 flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>
                Translation
                {session && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({targetLangLabel})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-4 overflow-y-auto">
              {translateLoading && (
                <div className="flex items-center justify-center py-8">
                  <Spinner
                    className="size-6"
                    aria-label="Translating document"
                  />
                </div>
              )}

              {!translateLoading &&
                !translateError &&
                translatedText !== null &&
                session && (
                  <>
                    <Textarea
                      readOnly
                      value={translatedText}
                      className="min-h-[120px] max-h-64 min-w-0 resize-none overflow-y-auto"
                      aria-label="Translated text"
                    />
                    {TTS_SUPPORTED_LANGS.has(session.targetLang) && (
                      <ReadAloudPanel
                        text={translatedText}
                        language={session.targetLang}
                        labelSuffix={targetLangLabel}
                      />
                    )}
                  </>
                )}
            </CardContent>
          </Card>
          {/* Summary */}
          {translatedText && session && (
            <TranslateSummary
              docId={id}
              translatedText={translatedText}
              targetLangLabel={targetLangLabel}
              outputLanguage={session.targetLang}
            />
          )}

          {session &&
            (() => {
              const safetyLang = getSafetyLang(session.targetLang)
              return (
                <Card className="flex w-full min-w-0 flex-col overflow-hidden">
                  <CardHeader>
                    <CardTitle>{SAFETY_UI_STRINGS[safetyLang].sectionTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex min-w-0 flex-col gap-4 overflow-y-auto">
                    <DetectTab docId={id} targetLang={session.targetLang} />
                  </CardContent>
                </Card>
              )
            })()}

          {session && (
            <AskTab
              docId={id}
              fullText={session.fullText}
              documentLanguage={session.sourceLang}
              translationTargetLang={session.targetLang}
              onJumpToSource={jumpToSource}
            />
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes everything stored in your browser for{' '}
              {session?.filename ?? 'this document'}—the upload, translation,
              summaries, safety analysis, and chat. This only affects this device
              and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault()
                void deleteDocumentFromDevice()
              }}
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
