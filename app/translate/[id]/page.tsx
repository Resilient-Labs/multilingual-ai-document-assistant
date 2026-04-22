'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ReadAloudPanel } from '@/components/features/tts/ReadAloudPanel'
import { TranslateSummary } from '@/components/features/summary/translate-summary'
import { AskTab } from '@/components/features/ask/AskTab'
import { DetectTab } from '@/components/features/detect/DetectTab'
import { cn } from '@/lib/utils'

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
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const originalDocTextareaRef = useRef<HTMLTextAreaElement>(null)

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
    const raw = sessionStorage.getItem(`translate-${id}`)
    if (!raw) {
      setSessionMissing(true)
      return
    }
    try {
      const parsed: TranslateSession = JSON.parse(raw)
      setSession(parsed)
    } catch {
      setSessionMissing(true)
    }
  }, [id])

  useEffect(() => {
    if (!session) return

    async function runTranslation() {
      setTranslateLoading(true)
      setTranslateError(null)
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: session!.fullText,
            targetLang: session!.targetLang,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error ?? 'Translation failed')
        }

        setTranslatedText(data.translatedText)
      } catch (err) {
        setTranslateError(
          err instanceof Error ? err.message : 'Translation failed'
        )
      } finally {
        setTranslateLoading(false)
      }
    }

    runTranslation()
  }, [session])

  if (sessionMissing) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>Session expired</AlertTitle>
            <AlertDescription>
              No document data found. Please upload your document again.
            </AlertDescription>
          </Alert>
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
              <p className="max-w-[200px] truncate text-sm font-medium md:max-w-xs">
                {session.filename}
              </p>
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

              {!translateLoading && translateError && (
                <Alert variant="destructive">
                  <AlertTitle>Translation failed</AlertTitle>
                  <AlertDescription>{translateError}</AlertDescription>
                </Alert>
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
              translatedText={translatedText}
              targetLangLabel={targetLangLabel}
              outputLanguage={session.targetLang}
            />
          )}

          {session && (
            <Card className="flex w-full min-w-0 flex-col overflow-hidden">
              <CardHeader>
                <CardTitle>Safety Analysis</CardTitle>
              </CardHeader>
              <CardContent className="flex min-w-0 flex-col gap-4 overflow-y-auto">
                <DetectTab docId={id} />
              </CardContent>
            </Card>
          )}

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

    </div>
  )
}
