'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileTextIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  getDocumentFromEntityDB,
  listSavedDocumentsFromEntityDB,
  type SavedDocumentListItem,
} from '@/lib/entitydb-persist'
import { getEntityDB } from '@/lib/entitydb'
import { getTranslateSessionByDocId } from '@/lib/entitydb-translate-cache'
import { cn } from '@/lib/utils'

export interface SavedDocumentsListProps {
  className?: string
}

function formatSavedAt(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

export function SavedDocumentsList({ className }: SavedDocumentsListProps) {
  const router = useRouter()
  const [items, setItems] = useState<SavedDocumentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await listSavedDocumentsFromEntityDB()
      setItems(next)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load saved documents.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openDocument = useCallback(
    async (docId: string) => {
      setOpeningId(docId)
      setError(null)
      try {
        const canonical = await getDocumentFromEntityDB(docId)
        if (!canonical) {
          setError('That document is no longer available in this browser.')
          await refresh()
          return
        }

        const fromIdb = await getTranslateSessionByDocId(getEntityDB(), docId)
        const fullText = canonical.ocr.fullText?.trim() ?? ''
        const session = fromIdb ?? {
          fullText,
          filename: canonical.document.filename,
          sourceLang: canonical.ocr.language?.trim() || 'auto',
          targetLang: 'en',
        }

        sessionStorage.setItem(`translate-${docId}`, JSON.stringify(session))
        sessionStorage.setItem('current-doc-id', docId)
        router.push(`/translate/${docId}`)
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not open that document.'
        )
      } finally {
        setOpeningId(null)
      }
    },
    [refresh, router]
  )

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground',
          className
        )}
      >
        <Spinner className="size-5" aria-hidden />
        <span>Loading saved documents…</span>
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className={cn('py-4 text-center text-sm text-destructive', className)}>
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className={cn('py-4 text-center text-sm text-muted-foreground', className)}>
        No saved documents in this browser yet. Upload a file to get started.
      </p>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Saved in this browser
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={() => void refresh()}
        >
          Refresh
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
        {items.map((item) => {
          const busy = openingId === item.docId
          return (
            <li key={item.docId}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-3 rounded-md px-3 py-2.5 text-left font-normal"
                disabled={busy}
                onClick={() => void openDocument(item.docId)}
              >
                {busy ? (
                  <Spinner className="size-4 shrink-0" aria-hidden />
                ) : (
                  <FileTextIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  <span className="w-full truncate text-sm font-medium text-foreground">
                    {item.filename}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatSavedAt(item.extractedAt)}
                  </span>
                </span>
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
