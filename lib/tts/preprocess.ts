/**
 * TTS preprocessing: clean and normalize text before synthesis.
 *
 * V1 Goals:
 * - Dynamic number normalization (0–999)
 * - Config-driven abbreviations
 * - Safe handling of decimals/IPs
 * - Lightweight, extensible pipeline
 *
 * TODO (Next Sprint):
 * - Add Spanish number normalization (es)
 * - Add Vietnamese tokenization + tone handling (vi)
 * - Add acronym handling (FBI → F B I)
 * - Add name pronunciation support (G2P or dictionary)
 * - Add domain-aware rules (legal/government formatting)
 */

// --- English number words (0–999) ---

const ONES = [
  'zero','one','two','three','four','five','six','seven','eight','nine',
  'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
  'seventeen','eighteen','nineteen',
] as const

const TENS = [
  '', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety',
] as const

function tensAndOnes(n: number): string {
  if (n < 20) return ONES[n] ?? ''
  if (n % 10 === 0) return TENS[Math.floor(n / 10)] ?? ''
  return `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`
}

export function numberToWordsEn(num: number): string {
  if (!Number.isInteger(num) || num < 0 || num > 999) return ''
  if (num < 100) return tensAndOnes(num)

  const hundreds = Math.floor(num / 100)
  const remainder = num % 100
  const head = `${ONES[hundreds]} hundred`

  return remainder === 0
    ? head
    : `${head} ${tensAndOnes(remainder)}`
}

// --- Abbreviation config (extendable) ---

const EN_ABBREVIATIONS: Record<string, string> = {
  'Dr.': 'Doctor',
  'Sec.': 'Section',
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Safer abbreviation replacement:
 * - Handles punctuation boundaries better than \b
 * - Preserves leading whitespace
 */
function applyEnglishAbbreviations(text: string): string {
  const entries = Object.entries(EN_ABBREVIATIONS).sort(
    (a, b) => b[0].length - a[0].length
  )

  let s = text

  for (const [abbr, full] of entries) {
    const pattern = new RegExp(`(^|\\s)${escapeRegex(abbr)}`, 'gi')
    s = s.replace(pattern, (_, prefix) => `${prefix}${full}`)
  }

  return s
}

// --- Mask decimals / IPs so we don’t break them ---

const MASK_BASE = 0xe000

function maskDottedNumbers(text: string): { masked: string; parts: string[] } {
  const parts: string[] = []

  const masked = text.replace(/\b\d+(?:\.\d+)+\b/g, (match) => {
    parts.push(match)
    return String.fromCharCode(MASK_BASE + parts.length - 1)
  })

  return { masked, parts }
}

function unmaskDottedNumbers(text: string, parts: string[]): string {
  let s = text
  parts.forEach((p, i) => {
    s = s.replaceAll(String.fromCharCode(MASK_BASE + i), p)
  })
  return s
}

// --- Number normalization ---

function normalizeEnglishNumbers(text: string): string {
  const { masked, parts } = maskDottedNumbers(text)

  const converted = masked.replace(/\b\d+\b/g, (m) => {
    // prevent converting long IDs / codes
    if (m.length > 3) return m

    const n = parseInt(m, 10)
    if (Number.isNaN(n) || n > 999) return m

    const words = numberToWordsEn(n)
    return words || m
  })

  return unmaskDottedNumbers(converted, parts)
}

// --- Optional: currency handling ---

function expandUsd(text: string): string {
  return text.replace(/\$(\d+)(?![\d.])/g, (full, digits) => {
    if (digits.length > 3) return full

    const n = parseInt(digits, 10)
    const words = numberToWordsEn(n)
    if (!words) return full

    return `${words} ${n === 1 ? 'dollar' : 'dollars'}`
  })
}

// --- General cleanup ---

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Safer sentence spacing:
 * - avoids decimals like 3.14
 * - avoids inserting spaces inside numbers
 */
function normalizeSentenceSpacing(text: string): string {
  let s = text

  // ! and ?
  s = s.replace(/([!?])(?=[A-Za-z])/g, '$1 ')

  // period (avoid decimals)
  s = s.replace(/([^0-9])\.(?=[A-Za-z])/g, '$1. ')

  return s.replace(/\s+/g, ' ')
}

// --- Language pipeline ---

function normalizeLang(lang: string): string {
  return (lang || '').split('-')[0].toLowerCase()
}

function applyLanguageRules(text: string, lang: string): string {
  if (normalizeLang(lang) !== 'en') return text

  let s = applyEnglishAbbreviations(text)
  s = expandUsd(s)
  s = normalizeEnglishNumbers(s)

  return normalizeWhitespace(s)
}

// --- Public API ---

export function preprocessText(text: string, lang: string): string {
  try {
    if (!text || typeof text !== 'string') return ''

    const trimmed = text.trim()
    if (!trimmed) return ''

    let out = normalizeWhitespace(trimmed)
    out = normalizeSentenceSpacing(out)
    out = applyLanguageRules(out, lang)

    return out
  } catch {
    return typeof text === 'string' ? text : ''
  }
}