'use client'

import { useState } from 'react'

import { clearAllAppClientStorage } from '@/lib/clear-all-client-storage'

const CONSOLE_SNIPPET = `void (async () => {
  await new Promise((r) => {
    const d = indexedDB.deleteDatabase('EntityDB')
    d.onsuccess = () => r()
    d.onerror = () => r()
    d.onblocked = () => r()
  })
  localStorage.clear()
  sessionStorage.clear()
  console.log('Cleared EntityDB + localStorage + sessionStorage')
  location.reload()
})()`

export default function DevClearStoragePage() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isDev = process.env.NODE_ENV === 'development'

  async function handleClear() {
    setBusy(true)
    setMessage(null)
    try {
      await clearAllAppClientStorage()
      setMessage(
        'Done. IndexedDB database "EntityDB", localStorage, and sessionStorage are cleared for this origin. Reload the app or navigate away.'
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-8 font-sans text-sm">
      <h1 className="text-lg font-semibold">Clear client storage</h1>
      {isDev ? (
        <>
          <p className="text-muted-foreground">
            Removes the <code className="rounded bg-muted px-1">EntityDB</code>{' '}
            IndexedDB database (vectors and related rows), then clears{' '}
            <code className="rounded bg-muted px-1">localStorage</code> and{' '}
            <code className="rounded bg-muted px-1">sessionStorage</code> for this
            site only.
          </p>
          <button
            type="button"
            className="rounded-md border border-input bg-background px-4 py-2 font-medium hover:bg-accent disabled:opacity-50"
            disabled={busy}
            onClick={() => void handleClear()}
          >
            {busy ? 'Clearing…' : 'Clear everything'}
          </button>
        </>
      ) : (
        <p className="text-muted-foreground">
          This button is only enabled in development (
          <code className="rounded bg-muted px-1">next dev</code>). For a production
          build, use your browser&apos;s site settings to clear storage, or open the
          app on this origin and run the snippet below in DevTools → Console.
        </p>
      )}
      {message ? <p className="rounded-md border border-border bg-muted/40 p-3">{message}</p> : null}
      <div className="space-y-2">
        <p className="font-medium">Console snippet (any page on this origin)</p>
        <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">{CONSOLE_SNIPPET}</pre>
      </div>
    </main>
  )
}
