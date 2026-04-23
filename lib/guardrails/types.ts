/**
 * Shared types for the lib/guardrails module.
 *
 * All guardrail layers (input validation, domain, request hardening,
 * output validation, fallback) use these types to communicate results
 * and errors in a consistent, structured way.
 */

// ---------------------------------------------------------------------------
// Layer identifiers
// ---------------------------------------------------------------------------

/**
 * The five guardrail layers, in execution order.
 * Used in error responses and log events to identify where a block occurred.
 */
export type GuardrailLayer =
  | 'input-validation'
  | 'domain'
  | 'request-hardening'
  | 'output-validation'
  | 'fallback'

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Machine-readable codes for guardrail rejections.
 * Clients can branch on these to show appropriate UI messages.
 */
export type GuardrailErrorCode =
  // Layer 1 – input validation
  | 'INVALID_INPUT'
  | 'TEXT_TOO_LONG'
  | 'MISSING_REQUIRED_FIELD'
  | 'PII_DETECTED'
  // Layer 2 – domain
  | 'UNSUPPORTED_LANGUAGE'
  | 'INJECTION_DETECTED'
  | 'CONTENT_POLICY_VIOLATION'
  // Layer 3 – request hardening
  | 'MALFORMED_UPSTREAM_REQUEST'
  // Layer 4 – output validation
  | 'INVALID_OUTPUT'
  | 'OUTPUT_PII_DETECTED'
  | 'UNEXPECTED_SOURCE_LANGUAGE'
  | 'INVALID_AUDIO_CONTENT_TYPE'
  | 'AUDIO_SIZE_OUT_OF_BOUNDS'
  // Layer 5 – fallback / circuit breaker
  | 'SERVICE_UNAVAILABLE'
  | 'CIRCUIT_OPEN'
  // Generic
  | 'INTERNAL_ERROR'

// ---------------------------------------------------------------------------
// Error response shape
// ---------------------------------------------------------------------------

/**
 * Structured error response returned by all guardrail layers.
 * The `layer` field tells the client (and monitoring) exactly where the
 * request was blocked, which simplifies debugging without leaking internals.
 */
export interface GuardrailErrorResponse {
  /** Human-readable description of what went wrong. */
  error: string
  /** Machine-readable rejection code. */
  code: GuardrailErrorCode
  /** The guardrail layer that produced this response. */
  layer: GuardrailLayer
  /** Optional structured details (never contains raw user text). */
  details?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Guardrail result discriminated union
// ---------------------------------------------------------------------------

/**
 * The return type of every individual guardrail check.
 *
 * - `{ ok: true; value: T }` — the check passed; `value` carries the
 *   (possibly sanitized / transformed) data to pass to the next layer.
 * - `{ ok: false; response: GuardrailErrorResponse; status: number }` — the
 *   check failed; `response` should be serialized to JSON and returned to the
 *   client with HTTP status `status`.
 */
export type GuardrailResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: GuardrailErrorResponse; status: number }

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

/**
 * States of the per-service circuit breaker.
 *
 * CLOSED  — normal operation; all requests flow through.
 * OPEN    — too many consecutive failures; requests are short-circuited and a
 *           fallback is returned immediately without hitting the upstream API.
 * HALF_OPEN — a probe request is allowed through after the cooldown period to
 *             test whether the upstream has recovered.
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * The external services whose circuit breakers are tracked independently.
 */
export type GuardrailService = 'deepl' | 'hf-space-tts'

export interface CircuitBreakerSnapshot {
  service: GuardrailService
  state: CircuitBreakerState
  consecutiveFailures: number
  lastFailureAt: number | null
  nextProbeAt: number | null
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

/**
 * Actions that a guardrail layer can take.
 * Used in log events to describe what happened at a given layer.
 */
export type GuardrailLogAction =
  | 'pass'
  | 'reject'
  | 'warn'
  | 'sanitize'
  | 'circuit-open'
  | 'circuit-close'
  | 'circuit-probe'

/**
 * Shape of a structured guardrail log event.
 * Raw user text must never appear here — use hashes or truncated lengths.
 */
export interface GuardrailLogEvent {
  /** ISO-8601 timestamp. */
  timestamp: string
  /** The API route that triggered this event (e.g. "/api/translate"). */
  route: string
  /** The guardrail layer that emitted this event. */
  layer: GuardrailLayer
  /** What the layer decided to do. */
  action: GuardrailLogAction
  /** Human-readable reason (safe for logs — no user data). */
  reason: string
  /** Optional structured metadata (lengths, codes, service names, etc.). */
  meta?: Record<string, unknown>
}
