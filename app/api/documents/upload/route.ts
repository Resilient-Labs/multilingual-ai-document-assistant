import { NextResponse } from 'next/server'
import { generateDocumentId } from '@/lib/documentId'
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from '@/lib/constants'
import { extractPdfText } from '@/lib/pdfExtract'
import type { OCRResult } from '@/types'
import mammoth from 'mammoth'
import WordExtractor from 'word-extractor'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const DOC_MIME = 'application/msword'

/**
 * Extract text from a file based on MIME type (with extension fallback).
 * Returns the extracted text or throws an error with a user-friendly message.
 */
async function extractTextFromFile(file: File): Promise<string> {
  const mimeType = file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  // Plain text
  if (mimeType === 'text/plain' || ext === 'txt') {
    return file.text()
  }

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    const buffer = Buffer.from(await file.arrayBuffer())
    return extractPdfText(buffer)
  }

  // DOCX (Office Open XML)
  if (mimeType === DOCX_MIME || ext === 'docx') {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // DOC (legacy Word format)
  if (mimeType === DOC_MIME || ext === 'doc') {
    const buffer = Buffer.from(await file.arrayBuffer())
    const extractor = new WordExtractor()
    const doc = await extractor.extract(buffer)
    return doc.getBody()
  }

  // Images are not yet supported for text extraction (need OCR service)
  if (mimeType.startsWith('image/')) {
    throw new Error(
      'Image text extraction is not yet supported. Please upload a PDF, TXT, DOC, or DOCX file.'
    )
  }

  throw new Error(
    `Unsupported file type: ${mimeType || ext}. Allowed: PDF, TXT, DOC, DOCX.`
  )
}

/**
 * POST /api/documents/upload
 * Stateless. Accept file, extract text, return structured JSON.
 * Client stores result in sessionStorage. Server stores nothing.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Max 4.5 MB.' },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            'Invalid file type. Allowed: PDF, TXT, DOC, DOCX, JPEG, PNG, WebP.',
        },
        { status: 400 }
      )
    }

    const docId = generateDocumentId()

    let fullText: string
    try {
      fullText = await extractTextFromFile(file)
    } catch (extractionError) {
      const message =
        extractionError instanceof Error
          ? extractionError.message
          : 'Failed to extract text from file'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (!fullText || fullText.trim() === '') {
      return NextResponse.json(
        { error: 'No readable text found in document' },
        { status: 400 }
      )
    }

    const ocrResult: OCRResult = {
      documentId: docId,
      fullText,
      blocks: [
        {
          id: 'b1',
          documentId: docId,
          text: fullText,
          confidence: 1.0,
        },
      ],
      language: 'en',
    }

    return NextResponse.json({
      docId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      createdAt: Date.now(),
      ocr: ocrResult,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
