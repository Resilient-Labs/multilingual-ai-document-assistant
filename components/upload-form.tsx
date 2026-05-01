'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  ArrowRightLeftIcon,
  CameraIcon,
  FileTextIcon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { logDocumentSubmission } from '@/app/actions/logging'
import { persistOCRToEntityDB } from '@/lib/entitydb-persist'
import type { OCRResult } from '@/types'
import { chunkText } from '@/lib/chunking'
import { insertChunk } from '@/lib/entitydb'
import { useLanguagePreference } from '@/hooks/useLanguagePreference'
import { useErrorPopup } from '@/hooks/useErrorPopup'
import { detectPii } from '@/lib/guardrails/pii'

const HEIC_BRANDS = [
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heis',
  'heim',
  'mif1',
  'msf1',
]

async function prepareImageBytes(
  file: File,
  onProgress: (msg: string) => void
): Promise<Uint8Array> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isFtyp =
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70
  const brand = isFtyp
    ? String.fromCharCode(header[8], header[9], header[10], header[11])
    : ''

  if (
    !HEIC_BRANDS.includes(brand) &&
    file.type !== 'image/heic' &&
    file.type !== 'image/heif'
  ) {
    return new Uint8Array(await file.arrayBuffer())
  }

  onProgress('Decoding HEIC image…')
  const libheif = await import('libheif-js/wasm-bundle')
  const rawBytes = new Uint8Array(await file.arrayBuffer())
  const images = new libheif.HeifDecoder().decode(rawBytes)
  if (!images?.length) throw new Error('Could not decode HEIC file.')

  const image = images[0]
  const canvas = document.createElement('canvas')
  canvas.width = image.get_width()
  canvas.height = image.get_height()

  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(canvas.width, canvas.height)

  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (result: ImageData | null) => {
      if (result) {
        resolve()
      } else {
        reject(new Error('HEIF display error'))
      }
    })
  })

  ctx.putImageData(imageData, 0, 0)
  return new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b
            ? b.arrayBuffer().then(resolve)
            : reject(new Error('canvas export failed')),
        'image/jpeg',
        0.9
      )
    })
  )
}

const LANGUAGES = [
  { code: 'auto', label: 'Detect language' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
]

const TARGET_LANGUAGES = LANGUAGES.filter((l) => l.code !== 'auto')

interface UploadFormProps {
  mobile?: boolean
}

export function UploadForm({ mobile = false }: UploadFormProps) {
  const router = useRouter()
  const { preferredLanguage, setLanguage } = useLanguagePreference()
  const { showError } = useErrorPopup()
  const [file, setFile] = useState<File | null>(null)
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('es')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ocrProgress, setOcrProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (preferredLanguage) {
      setTargetLang(preferredLanguage)
    }
  }, [preferredLanguage])

  useEffect(() => {
    if (!error) return
    showError('Upload failed', error)
  }, [error, showError])

  const isImage = file?.type.startsWith('image/') ?? false

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    logDocumentSubmission(sourceLang, targetLang).catch(() => { })
    if (!file) return

    setIsSubmitting(true)
    setError(null)
    setOcrProgress('Loading OCR engine…')

    try {
      let fullText: string
      let docId: string
      let ocrResult: OCRResult
      let createdAt: number
      let uploadPayload: {
        filename: string
        mimeType: string
        sizeBytes: number
        createdAt: number
        ocr: OCRResult
      } | null = null

      if (isImage) {
        // Client-side OCR — image never leaves the browser
        const { createWorker } = await import('tesseract.js')
        const worker = await createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(`Recognizing… ${Math.round(m.progress * 100)}%`)
            } else {
              setOcrProgress(m.status)
            }
          },
        })

        const bytes = await prepareImageBytes(file, setOcrProgress)
        const { data } = await worker.recognize(
          bytes as unknown as Parameters<typeof worker.recognize>[0],
          {},
          { text: true } as Parameters<typeof worker.recognize>[2]
        )
        await worker.terminate()

        fullText = data.text.trim()
        docId = `doc_${crypto.randomUUID()}`
        createdAt = Date.now()

        ocrResult = {
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
        }
      } else {
        // Server-side extraction for PDFs / docs
        setOcrProgress('Uploading…')
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error ?? 'Upload failed')

        fullText = payload.ocr.fullText
        docId = payload.docId
        createdAt = payload.createdAt ?? Date.now()
        ocrResult = payload.ocr
        uploadPayload = {
          filename: payload.filename ?? file.name,
          mimeType: payload.mimeType ?? file.type,
          sizeBytes: payload.sizeBytes ?? file.size,
          createdAt,
          ocr: payload.ocr,
        }
      }

      // Check for PII BEFORE any persistence
      setOcrProgress('Checking document for sensitive information…')
      const piiMatches = detectPii(fullText)
      if (piiMatches.length > 0) {
        const piiTypes = piiMatches.map((m) => m.label).join(', ')
        showError(
          'Sensitive Information Detected',
          `Your document appears to contain: ${piiTypes}. Please remove this information and try again.`
        )
        setFile(null)
        setOcrProgress(null)
        setIsSubmitting(false)
        return
      }

      // Only persist after PII check passes
      if (isImage) {
        await persistOCRToEntityDB({
          docId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          createdAt,
          ocr: ocrResult,
          file,
        })
      } else if (uploadPayload) {
        await persistOCRToEntityDB({
          docId,
          ...uploadPayload,
          file,
        })
      }

      setOcrProgress('Preparing document for Q&A…')

      Promise.resolve().then(async () => {
        try {
          const chunks = chunkText(fullText)
          for (const chunk of chunks) {
            await insertChunk(chunk.text, { docId, chunkId: chunk.id })
          }
        } catch (err) {
          console.error('[chunking] Failed to embed chunks:', err)
        }
      })

      sessionStorage.setItem(
        `translate-${docId}`,
        JSON.stringify({
          fullText,
          filename: file.name,
          sourceLang,
          targetLang,
        })
      )
      sessionStorage.setItem('current-doc-id', docId)
      router.push(`/translate/${docId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setOcrProgress(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'text/plain': ['.txt'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
    },
  })

  function swapLanguages() {
    if (sourceLang === 'auto') return
    const prev = sourceLang
    setSourceLang(targetLang)
    setTargetLang(prev)
  }

  function removeFile(e: React.MouseEvent) {
    e.stopPropagation()
    setFile(null)
  }

  const TranslationDirection = (
    <div
      className={cn(
        'rounded-2xl border border-border p-4',
        mobile ? 'bg-muted/20' : 'bg-muted/30'
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Translation direction
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-full h-9 text-sm rounded-xl">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Source</SelectLabel>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          onClick={swapLanguages}
          disabled={sourceLang === 'auto'}
          aria-label="Swap languages"
          className="flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowRightLeftIcon className="size-4" />
        </button>

        <div className="flex-1">
          <Select value={targetLang} onValueChange={(value) => {
            setTargetLang(value)
            setLanguage(value).catch(() => { })
          }}>
            <SelectTrigger className="w-full h-9 text-sm rounded-xl">
              <SelectValue placeholder="Target" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Target</SelectLabel>
                {TARGET_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const submitLabel =
    isSubmitting && ocrProgress ? ocrProgress : 'Translate document'

  /* ── Mobile layout ─────────────────────────────────────────────── */
  if (mobile) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 h-full">
        <div
          {...getRootProps()}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed cursor-pointer transition-colors min-h-[280px]',
            isDragActive
              ? 'border-indigo-400 bg-indigo-200'
              : 'border-indigo-300 bg-indigo-100'
          )}
        >
          <input {...getInputProps()} />

          {file ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-sm">
                <FileTextIcon className="size-4 shrink-0 text-indigo-500" />
                <span className="max-w-[180px] truncate text-sm font-medium">
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={removeFile}
                  aria-label="Remove file"
                  className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
              <span className="text-xs text-indigo-600">Tap to replace</span>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1 text-center px-8">
                <p className="text-base font-semibold text-foreground">
                  Take a photo or upload a file
                </p>
                <p className="text-sm text-muted-foreground">10MB max</p>
              </div>
              <Button
                size="default"
                type="button"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6"
              >
                <CameraIcon className="size-4" />
                Take photo
              </Button>
            </>
          )}
        </div>

        {TranslationDirection}

        <Button
          type="submit"
          disabled={!file || isSubmitting}
          className="w-full rounded-xl h-10"
        >
          {isSubmitting ? <Spinner className="size-4" /> : submitLabel}
        </Button>
      </form>
    )
  }

  /* ── Desktop layout ────────────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {TranslationDirection}

      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-10 py-16 text-center cursor-pointer transition-colors min-h-[280px]',
          isDragActive
            ? 'border-indigo-400 bg-indigo-200'
            : 'border-indigo-300 bg-indigo-100 hover:border-indigo-400 hover:bg-indigo-200'
        )}
      >
        <input {...getInputProps()} />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
              <FileTextIcon className="size-5 shrink-0 text-indigo-500" />
              <span className="max-w-[220px] truncate text-base font-medium">
                {file.name}
              </span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={removeFile}
                aria-label="Remove file"
                className="ml-1 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <span className="text-sm text-indigo-600">
              Click or drag to replace
            </span>
          </div>
        ) : (
          <>
            <UploadCloudIcon className="size-16 text-indigo-400" />
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">
                {isDragActive
                  ? 'Drop your file here'
                  : 'Drag & drop or choose a file'}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, DOC, DOCX, TXT, or image — 10 MB max
              </p>
            </div>
            <Button
              size="lg"
              variant="outline"
              type="button"
              className="px-8 text-base"
            >
              Browse files
            </Button>
          </>
        )}
      </div>

      <Button
        type="submit"
        disabled={!file || isSubmitting}
        size="lg"
        className="w-full text-base h-12"
      >
        {isSubmitting ? <Spinner className="size-5" /> : submitLabel}
      </Button>
    </form>
  )
}
