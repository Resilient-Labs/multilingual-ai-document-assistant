'use server'

import fs from 'fs'
import path from 'path'

function getTimeStamp() {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now)

  return `${date} ${time}`
}

export async function logDocumentSubmission(
  sourceLang: string,
  targetLang: string
): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), 'logs')
    const logsFile = path.join(logsDir, 'logs.json')

    fs.mkdirSync(logsDir, { recursive: true })

    let entries: unknown[] = []
    if (fs.existsSync(logsFile)) {
      try {
        const raw = fs.readFileSync(logsFile, 'utf-8')
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          entries = parsed
        }
      } catch {
        entries = []
      }
    }

    const entry = {
      timestamp: getTimeStamp(),
      type: 'Form Submission',
      requestId: '9f3c1a52-8a3b-4c28-b1b4-8e7d2e12f9aa',
      endpoint: '/submit',
      method: 'POST',
      status: 200,
      sourceLang,
      targetLang,
    }

    entries.push(entry)
    fs.writeFileSync(logsFile, JSON.stringify(entries, null, 2), 'utf-8')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[logDocumentSubmission] Failed to write log entry:', err)
  }
}
