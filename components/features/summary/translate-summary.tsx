'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

interface TranslateSummaryProps {
  translatedText: string | null
  targetLangLabel: string
}

export function TranslateSummary({
  translatedText,
  targetLangLabel,
}: TranslateSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

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
          body: JSON.stringify({ fullText: translatedText }),
        })

        const data = await res.json()

        if (!res.ok) throw new Error(data.error ?? 'Summary failed')
        setSummary(data.summary)
      } catch (err) {
        setSummaryError(err instanceof Error ? err.message : 'Summary failed')
      } finally {
        setSummaryLoading(false)
      }
    }

    runSummary()
  }, [translatedText])

  return (
    <Card className="flex w-full flex-col overflow-hidden">
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

      <CardContent className="flex flex-col gap-4 overflow-y-auto">
        {/* Loading */}
        {summaryLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" aria-label="Summarizing document" />
          </div>
        )}

        {/* Error */}
        {!summaryLoading && summaryError && (
          <Alert variant="destructive">
            <AlertTitle>Summary failed</AlertTitle>
            <AlertDescription>{summaryError}</AlertDescription>
          </Alert>
        )}

        {/* Success */}
        {!summaryLoading && !summaryError && summary && (
          <>
            <Textarea
              readOnly
              value={summary}
              className="min-h-[120px] max-h-64 resize-none overflow-y-auto"
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
