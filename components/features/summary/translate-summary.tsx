'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useErrorPopup } from '@/hooks/useErrorPopup'
import { getEntityDB } from '@/lib/entitydb'
import {
  persistSummaryCache,
  readCachedSummary,
  summaryInputFingerprint,
} from '@/lib/entitydb-translate-cache'

interface TranslateSummaryProps {
  /** Document id (translate route param); used for IndexedDB summary cache. */
  docId: string
  translatedText: string | null
  targetLangLabel: string
  /** BCP-47 style code (e.g. `es`, `zh-TW`). Summary is generated in this language. */
  outputLanguage?: string
}

export function TranslateSummary({
  docId,
  translatedText,
  targetLangLabel,
  outputLanguage,
}: TranslateSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const { showError } = useErrorPopup()

  // Auto-generate summary when translation updates (IndexedDB cache-first)
  useEffect(() => {
    if (!translatedText || !docId) return

    let cancelled = false
    const fingerprint = summaryInputFingerprint(
      translatedText,
      outputLanguage
    )

    void (async () => {
      setSummary(null)
      setSummaryLoading(true)
      setSummaryError(null)

      try {
        const cached = await readCachedSummary(
          getEntityDB(),
          docId,
          fingerprint
        )
        if (cancelled) return
        if (cached !== null) {
          setSummary(cached)
          return
        }

        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullText: translatedText,
            ...(outputLanguage ? { outputLanguage } : {}),
          }),
        })

        const data = (await res.json()) as {
          error?: string
          details?: string
          summary?: string
        }

        if (!res.ok) {
          const base = data.error ?? 'Summary failed'
          const detail =
            typeof data.details === 'string' && data.details.trim()
              ? ` ${data.details.trim()}`
              : ''
          throw new Error(`${base}${detail}`)
        }

        const nextSummary = data.summary ?? null
        if (cancelled) return
        setSummary(nextSummary)
        if (typeof nextSummary === 'string' && nextSummary.length > 0) {
          await persistSummaryCache(
            getEntityDB(),
            docId,
            fingerprint,
            nextSummary
          )
        }
      } catch (err) {
        if (!cancelled) {
          setSummaryError(
            err instanceof Error ? err.message : 'Summary failed'
          )
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [translatedText, outputLanguage, docId])

  useEffect(() => {
    if (!summaryError) return
    showError('Summary failed', summaryError)
  }, [showError, summaryError])

  return (
    <Card className="flex w-full min-w-0 flex-col overflow-hidden">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-x-2">
          <span>Summary</span>
          {targetLangLabel && (
            <span className="text-sm font-normal text-muted-foreground">
              ({targetLangLabel})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-w-0 flex-col gap-4 overflow-y-auto">
        {/* Loading */}
        {summaryLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" aria-label="Summarizing document" />
          </div>
        )}

        {/* Success */}
        {!summaryLoading && !summaryError && summary && (
          <>
            <Textarea
              readOnly
              value={summary}
              className="min-h-[140px] max-h-64 lg:max-h-[22rem] min-w-0 resize-none overflow-y-auto"
              aria-label="Summary text"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-10 w-full sm:w-auto"
                onClick={() => navigator.clipboard.writeText(summary)}
              >
                Copy Summary
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Summary limited to ~250 words
            </p>
          </>
        )}

        {/* Empty state */}
        {!summaryLoading && !summaryError && !summary && (
          <p className="text-xs text-muted-foreground">
            Summary will appear after translation completes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
