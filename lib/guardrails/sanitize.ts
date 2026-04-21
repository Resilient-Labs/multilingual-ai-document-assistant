/**
 * Text sanitization for the guardrails pipeline (Layer 1).
 *
 * Applied to all input text before PII detection and upstream API calls.
 * Order of operations matters — Unicode normalization runs last so that
 * subsequent layers see a consistent codepoint representation.
 */

// ---------------------------------------------------------------------------
// HTML / script stripping
// ---------------------------------------------------------------------------

/**
 * Patterns that represent markup or script payloads that have no legitimate
 * place in translation or TTS input.
 *
 * We match both full tags and dangling attribute injections such as
 * `" onload="alert(1)"` to catch common XSS probe patterns.
 */
const HTML_TAG_REGEX = /<\/?[a-zA-Z][^>]*\/?>/g
const SCRIPT_CONTENT_REGEX = /<script[\s\S]*?<\/script>/gi
const STYLE_CONTENT_REGEX = /<style[\s\S]*?<\/style>/gi
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g
/** Detached event-handler / href injection: `" onload="..."` */
const ATTR_INJECT_REGEX = /\s+on[a-zA-Z]+\s*=\s*["'][^"']*["']/gi

/**
 * Remove HTML tags, script/style blocks, HTML comments, and injected
 * event-handler attributes from `text`.
 */
export function stripHtml(text: string): string {
  return text
    .replace(SCRIPT_CONTENT_REGEX, '')
    .replace(STYLE_CONTENT_REGEX, '')
    .replace(HTML_COMMENT_REGEX, '')
    .replace(ATTR_INJECT_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
}

// ---------------------------------------------------------------------------
// Zero-width / invisible Unicode removal
// ---------------------------------------------------------------------------

/**
 * Zero-width and invisible Unicode characters that can be used to obfuscate
 * content or bypass text-similarity checks.
 *
 * Ranges covered:
 * - U+200B  ZERO WIDTH SPACE
 * - U+200C  ZERO WIDTH NON-JOINER
 * - U+200D  ZERO WIDTH JOINER
 * - U+200E  LEFT-TO-RIGHT MARK
 * - U+200F  RIGHT-TO-LEFT MARK
 * - U+202A–U+202E  bidirectional embedding / override controls
 * - U+2060  WORD JOINER
 * - U+FEFF  ZERO WIDTH NO-BREAK SPACE (BOM)
 * - U+FFF9–U+FFFB  interlinear annotation anchors
 */
const ZERO_WIDTH_REGEX =
  /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\uFFF9-\uFFFB]/g

/**
 * Strip zero-width and invisible Unicode characters from `text`.
 */
export function removeZeroWidth(text: string): string {
  return text.replace(ZERO_WIDTH_REGEX, '')
}

// ---------------------------------------------------------------------------
// Whitespace normalization
// ---------------------------------------------------------------------------

/**
 * Collapse runs of whitespace (spaces, tabs, newlines) down to a single space,
 * then trim leading/trailing whitespace.
 *
 * We preserve intentional line breaks for readability — only *excessive* runs
 * (3+ consecutive newlines) are collapsed to two newlines so paragraph
 * structure is retained.
 */
export function collapseWhitespace(text: string): string {
  return (
    text
      // Collapse 3+ consecutive newlines → two newlines (preserve paragraphs)
      .replace(/\n{3,}/g, '\n\n')
      // Collapse horizontal whitespace runs (spaces/tabs) to a single space
      .replace(/[ \t]+/g, ' ')
      // Remove spaces sitting alone on a line (artifact of tag stripping)
      .replace(/^ +$/gm, '')
      .trim()
  )
}

// ---------------------------------------------------------------------------
// Composed sanitizer
// ---------------------------------------------------------------------------

export interface SanitizeResult {
  /** The cleaned text ready for downstream processing. */
  sanitized: string
  /**
   * True if any mutations were applied — useful for deciding whether to emit
   * a 'sanitize' log event.
   */
  wasModified: boolean
}

/**
 * Run the full sanitization pipeline on `text`:
 * 1. Strip HTML tags, script/style blocks, and injected event attributes.
 * 2. Remove zero-width / invisible Unicode characters.
 * 3. Normalize to NFC Unicode form (canonical decomposition then composition).
 * 4. Collapse excessive whitespace and trim.
 *
 * Returns the sanitized string and a flag indicating whether the text changed.
 */
export function sanitizeText(text: string): SanitizeResult {
  const step1 = stripHtml(text)
  const step2 = removeZeroWidth(step1)
  const step3 = step2.normalize('NFC')
  const step4 = collapseWhitespace(step3)

  return {
    sanitized: step4,
    wasModified: step4 !== text,
  }
}
