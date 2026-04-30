'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useErrorPopup } from '@/hooks/useErrorPopup'

interface TranslateSummaryProps {
  translatedText: string | null
  targetLangLabel: string
  /** BCP-47 style code (e.g. `es`, `zh-TW`). Summary is generated in this language. */
  outputLanguage?: string
}

export function TranslateSummary({
  translatedText,
  targetLangLabel,
  outputLanguage,
}: TranslateSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const { showError } = useErrorPopup()

  // Auto-generate summary when translation updates
  useEffect(() => {
    if (!translatedText) return

    async function runSummary() {
      setSummary(null)
      setSummaryLoading(true)
      setSummaryError(null)

      try {
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
        setSummary(data.summary ?? null)
      } catch (err) {
        setSummaryError(err instanceof Error ? err.message : 'Summary failed')
      } finally {
        setSummaryLoading(false)
      }
    }

    runSummary()
  }, [translatedText, outputLanguage])

  useEffect(() => {
    if (!summaryError) return
    showError('Summary failed', summaryError)
  }, [showError, summaryError])

  return (
    <Card className="flex w-full min-w-0 flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>
          Summary
          {targetLangLabel && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
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
              className="min-h-[120px] max-h-64 min-w-0 resize-none overflow-y-auto"
              aria-label="Summary text"
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
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
