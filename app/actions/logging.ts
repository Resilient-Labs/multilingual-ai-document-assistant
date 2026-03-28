'use server'

import crypto from 'crypto'

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
    const entry = {
      timestamp: getTimeStamp(),
      type: 'Form Submission',
      requestId: crypto.randomUUID(),
      endpoint: '/submit',
      method: 'POST',
      status: 200,
      sourceLang,
      targetLang,
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[logDocumentSubmission] Failed to write log entry:', err)
  }
}
