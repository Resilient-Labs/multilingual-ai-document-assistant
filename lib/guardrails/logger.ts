/**
 * Structured guardrail event logging (Layer 5 — cross-cutting concern).
 *
 * All guardrail pipeline events (rejections, passes, circuit breaker state
 * changes, PII detections, sanitization steps) are recorded through this
 * module as structured JSON objects conforming to `GuardrailLogEvent`.
 *
 * Privacy guarantees:
 * - Raw user text NEVER appears in log output.
 * - Only safe metadata is logged: character lengths, truncated prefixes
 *   (first 8 chars max for debugging label hints), service names, codes,
 *   and timestamps.
 * - Text values are either omitted, replaced with their byte/char length,
 *   or hashed with a fast non-cryptographic fingerprint for correlation.
 *
 * Log levels:
 * - `info`  — normal pipeline passes and sanitization steps
 * - `warn`  — soft checks that flag but do not block (e.g. unexpected source
 *             language, output PII re-detection)
 * - `error` — hard blocks (PII detected, injection attempt, invalid output,
 *             circuit open, internal errors)
 *
 * Output:
 * Writes to `console.info` / `console.warn` / `console.error` as a single
 * JSON line so log aggregators (Vercel, Datadog, CloudWatch, etc.) can parse
 * and index structured fields without further configuration.  No additional
 * dependencies are required.
 *
 * Usage
 * ─────
 *   import { guardrailLog } from '@/lib/guardrails/logger'
 *
 *   guardrailLog('info', {
 *     route: '/api/translate',
 *     layer: 'input-validation',
 *     action: 'pass',
 *     reason: 'Zod schema validated',
 *     meta: { textLength: text.length, targetLang },
 *   })
 *
 *   guardrailLog('error', {
 *     route: '/api/translate',
 *     layer: 'domain',
 *     action: 'reject',
 *     reason: 'Injection pattern detected',
 *     meta: { patternIndex: 2, textLength: text.length },
 *   })
 */

import type { GuardrailLogEvent, GuardrailLayer, GuardrailLogAction } from './types'

// ---------------------------------------------------------------------------
// Public log level
// ---------------------------------------------------------------------------

export type GuardrailLogLevel = 'info' | 'warn' | 'error'

// ---------------------------------------------------------------------------
// Options for constructing an event without the auto-populated timestamp
// ---------------------------------------------------------------------------

/**
 * Input type for `guardrailLog`.
 * All fields mirror `GuardrailLogEvent` except `timestamp`, which is injected
 * automatically to avoid caller clock drift.
 */
export interface GuardrailLogOptions {
  /** The API route path (e.g. "/api/translate", "/api/tts"). */
  route: string
  /** The guardrail layer emitting this event. */
  layer: GuardrailLayer
  /** What the layer decided to do. */
  action: GuardrailLogAction
  /**
   * Human-readable reason suitable for logs.
   * Must NOT contain raw user text — describe the pattern or code instead.
   * Good:  "SSN pattern matched"
   * Bad:   `"PII found: ${text}"`
   */
  reason: string
  /**
   * Optional structured metadata.
   * Acceptable values: lengths, language codes, service names, error codes,
   * circuit breaker state, boolean flags.
   * Forbidden values: raw user text, full stack traces, API keys.
   */
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Core logging function
// ---------------------------------------------------------------------------

/**
 * Emits a structured guardrail log event at the given level.
 *
 * The event is serialized to a single JSON line and written to the
 * corresponding `console` method so that log collectors pick it up as one
 * structured record.
 *
 * @param level  - Severity of the event.
 * @param options - Event fields (timestamp is injected automatically).
 */
export function guardrailLog(
  level: GuardrailLogLevel,
  options: GuardrailLogOptions
): void {
  const event: GuardrailLogEvent & { level: GuardrailLogLevel } = {
    timestamp: new Date().toISOString(),
    level,
    route: options.route,
    layer: options.layer,
    action: options.action,
    reason: options.reason,
    ...(options.meta !== undefined && { meta: options.meta }),
  }

  const line = JSON.stringify(event)

  switch (level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    default:
      console.info(line)
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Logs a guardrail `pass` event at info level.
 * Call this when a layer accepts input and forwards it to the next stage.
 */
export function logPass(
  route: string,
  layer: GuardrailLayer,
  reason: string,
  meta?: Record<string, unknown>
): void {
  guardrailLog('info', { route, layer, action: 'pass', reason, meta })
}

/**
 * Logs a guardrail `reject` event at error level.
 * Call this when a layer blocks a request.
 */
export function logReject(
  route: string,
  layer: GuardrailLayer,
  reason: string,
  meta?: Record<string, unknown>
): void {
  guardrailLog('error', { route, layer, action: 'reject', reason, meta })
}

/**
 * Logs a guardrail `warn` event.
 * Call this when a layer detects a soft issue (e.g. unexpected source language,
 * output PII re-detection) that is flagged but does not block the response.
 */
export function logWarn(
  route: string,
  layer: GuardrailLayer,
  reason: string,
  meta?: Record<string, unknown>
): void {
  guardrailLog('warn', { route, layer, action: 'warn', reason, meta })
}

/**
 * Logs a `sanitize` event at info level.
 * Call this after text sanitization to record what transformations were applied
 * without logging the before/after text content.
 */
export function logSanitize(
  route: string,
  reason: string,
  meta?: Record<string, unknown>
): void {
  guardrailLog('info', {
    route,
    layer: 'input-validation',
    action: 'sanitize',
    reason,
    meta,
  })
}

/**
 * Logs a circuit breaker state-change event.
 *
 * @param route   - The API route path (e.g. "/api/translate", "/api/tts").
 * @param action  - `'circuit-open'`, `'circuit-close'`, or `'circuit-probe'`
 * @param service - The upstream service whose breaker changed state.
 * @param meta    - Optional additional context (consecutive failures, etc.).
 */
export function logCircuitBreaker(
  route: string,
  action: Extract<GuardrailLogAction, 'circuit-open' | 'circuit-close' | 'circuit-probe'>,
  service: string,
  meta?: Record<string, unknown>
): void {
  const level: GuardrailLogLevel = action === 'circuit-open' ? 'error' : 'info'
  guardrailLog(level, {
    route,
    layer: 'fallback',
    action,
    reason: `Circuit breaker ${action} for service: ${service}`,
    meta: { service, ...meta },
  })
}

// ---------------------------------------------------------------------------
// Safe text helpers (used by callers to build meta without leaking user data)
// ---------------------------------------------------------------------------

/**
 * Returns the character length of a string — safe to include in log metadata.
 * Use this instead of passing `text` directly.
 *
 * @example
 *   meta: { textLength: safeLength(text) }
 */
export function safeLength(text: string): number {
  return text.length
}

/**
 * Returns a non-reversible 32-bit fingerprint of a string encoded as an
 * 8-character hex string.  Useful for correlating log events that touch the
 * same input across layers without storing the raw content.
 *
 * Algorithm: djb2 (fast, dependency-free, sufficient for log correlation).
 * This is NOT a cryptographic hash — do not use it for security purposes.
 *
 * @example
 *   meta: { inputHash: hashForLog(text) }
 */
export function hashForLog(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    // djb2: h = h * 33 ^ charCode
    h = ((h << 5) + h) ^ text.charCodeAt(i)
    h = h >>> 0 // keep as unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0')
}
