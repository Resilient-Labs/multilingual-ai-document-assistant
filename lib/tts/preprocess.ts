/**
 * TTS Text Preprocessing Pipeline
 *
 * Transforms raw text into clean, pronounceable output before it reaches
 * any TTS synthesis backend.
 *
 * Pipeline order:
 *   1. Text Cleaning       (all languages)
 *   2. Numbers             (all languages)
 *   3. Legal Terms         (English only)
 *   4. Medical Terms       (English only)
 *   5. Abbreviations       (English only)
 *   6. Acronyms            (English only)
 *   7. Names               (English only, runs last)
 */

// ---------------------------------------------------------------------------
// 1. Text Cleaning
// ---------------------------------------------------------------------------

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')        // strip HTML / XML tags
    .replace(/\u2014/g, ' - ')      // em dash → spaced hyphen
    .replace(/\u2013/g, ' - ')      // en dash → spaced hyphen
    .replace(/[\u201C\u201D]/g, '"') // curly double quotes → straight
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes → straight
    .replace(/\u2026/g, '...')       // ellipsis character → three dots
    .replace(/\s+/g, ' ')           // collapse whitespace / newlines
    .trim()
}

// ---------------------------------------------------------------------------
// 2. Numbers  (all languages)
// ---------------------------------------------------------------------------

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
]
const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const ORDINALS: Record<number, string> = {
  1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
  6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
  11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth',
  15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth',
  19: 'nineteenth', 20: 'twentieth', 21: 'twenty-first', 22: 'twenty-second',
  23: 'twenty-third', 24: 'twenty-fourth', 25: 'twenty-fifth', 26: 'twenty-sixth',
  27: 'twenty-seventh', 28: 'twenty-eighth', 29: 'twenty-ninth', 30: 'thirtieth',
  31: 'thirty-first',
}

function cardinalToWords(n: number): string {
  if (n < 0) return `negative ${cardinalToWords(-n)}`
  if (n < 20) return ONES[n] ?? String(n)
  if (n < 100) {
    const ten = TENS[Math.floor(n / 10)] ?? ''
    const one = n % 10 === 0 ? '' : `-${ONES[n % 10]}`
    return `${ten}${one}`
  }
  if (n < 1000) {
    const remainder = n % 100
    const rest = remainder === 0 ? '' : ` ${cardinalToWords(remainder)}`
    return `${ONES[Math.floor(n / 100)]} hundred${rest}`
  }
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000)
    const remainder = n % 1000
    const rest = remainder === 0 ? '' : ` ${cardinalToWords(remainder)}`
    return `${cardinalToWords(thousands)} thousand${rest}`
  }
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000)
    const remainder = n % 1_000_000
    const rest = remainder === 0 ? '' : ` ${cardinalToWords(remainder)}`
    return `${cardinalToWords(millions)} million${rest}`
  }
  return String(n)
}

function digitsToWords(digits: string): string {
  return digits
    .split('')
    .map(d => {
      const n = parseInt(d, 10)
      return n === 0 ? 'zero' : (ONES[n] ?? d)
    })
    .join(' ')
}

function yearToWords(year: number): string {
  if (year >= 2000 && year <= 2099) {
    const suffix = year % 100
    if (suffix === 0) return `two thousand`
    if (suffix < 10) return `two thousand ${cardinalToWords(suffix)}`
    return `twenty ${cardinalToWords(suffix)}`
  }
  if (year >= 1100 && year <= 1999) {
    const century = Math.floor(year / 100)
    const suffix = year % 100
    if (suffix === 0) return `${cardinalToWords(century)} hundred`
    return `${cardinalToWords(century)} ${cardinalToWords(suffix)}`
  }
  return cardinalToWords(year)
}

function normalizeNumbers(text: string): string {
  // Phone: NXX-NXX-XXXX (N = 2–9). Validated before transforming.
  text = text.replace(
    /\b([2-9]\d{2})[-.\s]([2-9]\d{2})[-.\s](\d{4})\b/g,
    (_, a: string, b: string, c: string) => digitsToWords(a + b + c),
  )

  // Currency: $1,234.56 or $45.50 or $10
  text = text.replace(
    /\$(\d{1,3}(?:,\d{3})*)(?:\.(\d{2}))?/g,
    (_, dollars: string, cents: string | undefined) => {
      const dollarNum = parseInt(dollars.replace(/,/g, ''), 10)
      const dollarWord = cardinalToWords(dollarNum)
      if (cents && cents !== '00') {
        const centNum = parseInt(cents, 10)
        return `${dollarWord} dollar${dollarNum !== 1 ? 's' : ''} and ${cardinalToWords(centNum)} cent${centNum !== 1 ? 's' : ''}`
      }
      return `${dollarWord} dollar${dollarNum !== 1 ? 's' : ''}`
    },
  )

  // Date: MM/DD/YYYY — strict month (01–12) and day (01–31) validation
  text = text.replace(
    /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{4})\b/g,
    (_, month: string, day: string, year: string) => {
      const monthName = MONTHS[parseInt(month, 10)] ?? month
      const dayOrdinal = ORDINALS[parseInt(day, 10)] ?? cardinalToWords(parseInt(day, 10))
      return `${monthName} ${dayOrdinal}, ${yearToWords(parseInt(year, 10))}`
    },
  )

  // Decimal: digits.digits (not already consumed as currency/date)
  text = text.replace(
    /\b(\d+)\.(\d+)\b/g,
    (_, whole: string, frac: string) =>
      `${cardinalToWords(parseInt(whole, 10))} point ${digitsToWords(frac)}`,
  )

  // Cardinal: bare integers
  text = text.replace(/\b(\d+)\b/g, (_, n: string) => cardinalToWords(parseInt(n, 10)))

  return text
}

// ---------------------------------------------------------------------------
// 3. Legal Terms  (English only)
// ---------------------------------------------------------------------------

function expandLegalTerms(text: string): string {
  // Case citation: "Brown v. Board" — v. surrounded by capitalized words
  text = text.replace(/(?<=[A-Z][a-z]+\s)v\.(?=\s[A-Z])/g, 'versus')
  text = text.replace(/§\s*(\w+)/g, 'section $1')
  text = text.replace(/\bet al\./gi, 'and others')
  text = text.replace(/\bibid\./gi, 'in the same place')
  text = text.replace(/\bviz\./gi, 'namely')
  text = text.replace(/\bcf\./gi, 'compare')
  text = text.replace(/\be\.g\./gi, 'for example')
  text = text.replace(/\bi\.e\./gi, 'that is')
  return text
}

// ---------------------------------------------------------------------------
// 4. Medical Terms  (English only)
// ---------------------------------------------------------------------------

function expandMedicalTerms(text: string): string {
  // Units — must follow a number or space to avoid partial matches
  text = text.replace(/\bmmHg\b/g, 'millimeters of mercury')
  text = text.replace(/\bmcg\b/g, 'micrograms')
  text = text.replace(/\bmg\b/g, 'milligrams')
  text = text.replace(/\bmL\b/g, 'milliliters')
  text = text.replace(/\bml\b/g, 'milliliters')
  text = text.replace(/\bkg\b/g, 'kilograms')
  text = text.replace(/\bcm\b/g, 'centimeters')

  // Abbreviations — whole word, uppercase only to reduce false positives
  text = text.replace(/\bBP\b/g, 'blood pressure')
  text = text.replace(/\bHR\b/g, 'heart rate')
  text = text.replace(/\bBMI\b/g, 'body mass index')
  text = text.replace(/\bRx\b/g, 'prescription')
  text = text.replace(/\bDx\b/g, 'diagnosis')
  text = text.replace(/\bHx\b/g, 'history')
  text = text.replace(/\bTx\b/g, 'treatment')
  text = text.replace(/\bICU\b/g, 'intensive care unit')
  text = text.replace(/\bER\b/g, 'emergency room')

  return text
}

// ---------------------------------------------------------------------------
// 5. Abbreviations  (English only)
// ---------------------------------------------------------------------------

// Titles only fire when followed by a capitalized name (lookahead)
const TITLE_ABBREVIATIONS: [RegExp, string][] = [
  [/\bDr\.(?=\s+[A-Z])/g, 'Doctor'],
  [/\bMr\.(?=\s+[A-Z])/g, 'Mister'],
  [/\bMrs\.(?=\s+[A-Z])/g, 'Missus'],
  [/\bMs\.(?=\s+[A-Z])/g, 'Miss'],
  [/\bProf\.(?=\s+[A-Z])/g, 'Professor'],
  [/\bSgt\.(?=\s+[A-Z])/g, 'Sergeant'],
  [/\bCpl\.(?=\s+[A-Z])/g, 'Corporal'],
  [/\bLt\.(?=\s+[A-Z])/g, 'Lieutenant'],
  [/\bSt\.(?=\s+[A-Z])/g, 'Saint'],
  [/\bRev\.(?=\s+[A-Z])/g, 'Reverend'],
  [/\bHon\.(?=\s+[A-Z])/g, 'Honorable'],
]

const COMMON_ABBREVIATIONS: [RegExp, string][] = [
  [/\betc\./gi, 'et cetera'],
  [/\bapprox\./gi, 'approximately'],
  [/\bdept\./gi, 'department'],
  [/\bave\./gi, 'avenue'],
  [/\bblvd\./gi, 'boulevard'],
  [/\brd\./gi, 'road'],
  [/\bft\./gi, 'feet'],
  [/\bin\./gi, 'inches'],
]

function expandAbbreviations(text: string): string {
  for (const [pattern, replacement] of TITLE_ABBREVIATIONS) {
    text = text.replace(pattern, replacement)
  }
  for (const [pattern, replacement] of COMMON_ABBREVIATIONS) {
    text = text.replace(pattern, replacement)
  }
  return text
}

// ---------------------------------------------------------------------------
// 6. Acronyms  (English only)
// ---------------------------------------------------------------------------

/**
 * Pronounced as a word — output is the phonetic spoken form.
 * Case is intentionally lowercase so TTS reads it as a word, not initials.
 */
const PRONOUNCED_ACRONYMS: Record<string, string> = {
  NASA: 'nassa',
  NATO: 'nato',
  FEMA: 'feema',
  UNICEF: 'unicef',
  OPEC: 'opec',
  RADAR: 'radar',
  LASER: 'laser',
  SCUBA: 'scuba',
  AIDS: 'aids',
  NAFTA: 'nafta',
}

/**
 * Spelled out letter-by-letter — each letter separated by a space
 * so TTS reads them as individual initials.
 */
const SPELLED_ACRONYMS: Record<string, string> = {
  FBI: 'F B I',
  CIA: 'C I A',
  IRS: 'I R S',
  DNA: 'D N A',
  USA: 'U S A',
  UK: 'U K',
  UN: 'U N',
  EU: 'E U',
  GOP: 'G O P',
  ATM: 'A T M',
  PIN: 'P I N',
  CEO: 'C E O',
  CFO: 'C F O',
  HR: 'H R',
  IT: 'I T',
  PR: 'P R',
  TV: 'T V',
  PC: 'P C',
  ID: 'I D',
  OK: 'O K',
}

function expandAcronyms(text: string): string {
  // Replace known acronyms first (longest match wins via dict order)
  return text.replace(/\b([A-Z]{2,})\b/g, (match) => {
    if (match in PRONOUNCED_ACRONYMS) return PRONOUNCED_ACRONYMS[match] ?? match
    if (match in SPELLED_ACRONYMS) return SPELLED_ACRONYMS[match] ?? match
    // Fallback: spell out letter-by-letter
    return match.split('').join(' ')
  })
}

// ---------------------------------------------------------------------------
// 7. Names  (English only, runs last)
// ---------------------------------------------------------------------------

/**
 * Minimal, explicit phonetic overrides for names with non-obvious pronunciation.
 * Whole-word matches only (\b on both sides).
 * Keep this list small to minimize false positives.
 */
const NAME_OVERRIDES: [RegExp, string][] = [
  [/\bSean\b/g, 'Shawn'],
  [/\bSiobhan\b/g, 'Shivawn'],
  [/\bNguyen\b/g, 'Win'],
  [/\bJose\b/g, 'Hozay'],
  [/\bJoaquin\b/g, 'Wah-keen'],
  [/\bXiomara\b/g, 'Syo-mara'],
]

function applyNameOverrides(text: string): string {
  for (const [pattern, replacement] of NAME_OVERRIDES) {
    text = text.replace(pattern, replacement)
  }
  return text
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Preprocesses raw text for TTS synthesis.
 *
 * @param text    The raw input string (may contain HTML, numbers, abbreviations, etc.)
 * @param lang    BCP-47 language code (e.g. "en", "es", "vi"). Non-English input
 *                still gets text cleaning and number normalization; the English-specific
 *                dictionary passes are skipped.
 * @returns       A clean, pronounceable string ready for TTS.
 */
export function preprocessTextForTts(text: string, lang: string): string {
  const normalized = lang === 'auto' ? 'en' : lang.trim().toLowerCase()
  const isEnglish = normalized === 'en' || normalized.startsWith('en-')

  let result = cleanText(text)
  result = normalizeNumbers(result)

  if (isEnglish) {
    result = expandLegalTerms(result)
    result = expandMedicalTerms(result)
    result = expandAbbreviations(result)
    result = expandAcronyms(result)
    result = applyNameOverrides(result)
  }

  return result
}

// Alias for compatibility with route-level imports
export const preprocessText = preprocessTextForTts
