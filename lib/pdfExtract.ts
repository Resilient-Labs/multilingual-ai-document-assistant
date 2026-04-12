/**
 * PDF text extraction using unpdf.
 * Designed for Node.js server environments without canvas dependencies.
 */

import { extractText } from 'unpdf'

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer)
  const result = await extractText(uint8Array)
  // text is an array of strings (one per page)
  return Array.isArray(result.text)
    ? result.text.join('\n\n')
    : String(result.text)
}
