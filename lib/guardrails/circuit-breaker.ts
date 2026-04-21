/**
 * In-memory circuit breaker for external upstream services (Layer 5).
 *
 * Each service tracked by `GuardrailService` gets its own independent breaker
 * instance held in module-level state.  This is intentionally process-local:
 * in a multi-instance deployment every replica maintains its own counters,
 * which is acceptable because the goal is to prevent a single replica from
 * hammering a failing upstream — not global coordination.
 *
 * State machine:
 *
 *   CLOSED ──(N consecutive failures)──► OPEN
 *     ▲                                    │
 *     │                           (cooldown expires)
 *     │                                    ▼
 *     └──────(probe succeeds)────── HALF_OPEN
 *                                          │
 *                              (probe fails)
 *                                          │
 *                                          ▼
 *                                        OPEN  (cooldown resets)
 *
 * Usage
 * ─────
 *   const cb = getCircuitBreaker('deepl')
 *
 *   // Before the upstream call:
 *   const check = cb.before()
 *   if (!check.ok) return NextResponse.json(check.response, { status: check.status })
 *
 *   // After the call:
 *   if (upstreamSucceeded) cb.onSuccess()
 *   else                   cb.onFailure()
 */

import type {
  CircuitBreakerState,
  CircuitBreakerSnapshot,
  GuardrailService,
  GuardrailResult,
} from './types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface CircuitBreakerConfig {
  /** Number of consecutive failures required to trip the breaker. */
  failureThreshold: number
  /** Milliseconds to wait in OPEN state before moving to HALF_OPEN. */
  cooldownMs: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 60_000,
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface CircuitBreakerInternalState {
  state: CircuitBreakerState
  consecutiveFailures: number
  lastFailureAt: number | null
  /** Timestamp at which a HALF_OPEN probe is allowed. */
  nextProbeAt: number | null
}

function makeInitialState(): CircuitBreakerInternalState {
  return {
    state: 'CLOSED',
    consecutiveFailures: 0,
    lastFailureAt: null,
    nextProbeAt: null,
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker class
// ---------------------------------------------------------------------------

/**
 * A single circuit breaker instance for one upstream service.
 * All methods are synchronous and side-effect-free except for mutating
 * the internal state struct.
 */
export class CircuitBreaker {
  private readonly service: GuardrailService
  private readonly config: CircuitBreakerConfig
  private s: CircuitBreakerInternalState

  constructor(service: GuardrailService, config: CircuitBreakerConfig) {
    this.service = service
    this.config = config
    this.s = makeInitialState()
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Call before making an upstream request.
   *
   * Returns `{ ok: true }` when the request should proceed.
   * Returns `{ ok: false, … }` when the circuit is OPEN and the request
   * should be short-circuited with a 503 fallback.
   */
  before(): GuardrailResult<void> {
    const now = Date.now()

    if (this.s.state === 'CLOSED') {
      return { ok: true, value: undefined }
    }

    if (this.s.state === 'HALF_OPEN') {
      // A probe is already in flight or ready to go — allow exactly one
      // request through to test the upstream.
      return { ok: true, value: undefined }
    }

    // State is OPEN — check whether the cooldown has expired.
    if (this.s.nextProbeAt !== null && now >= this.s.nextProbeAt) {
      this.s.state = 'HALF_OPEN'
      return { ok: true, value: undefined }
    }

    // Still OPEN — short-circuit.
    const retryAfterSec =
      this.s.nextProbeAt !== null
        ? Math.ceil((this.s.nextProbeAt - now) / 1_000)
        : null

    return {
      ok: false,
      status: 503,
      response: {
        error: `The ${this.service} service is temporarily unavailable. Please try again later.`,
        code: 'CIRCUIT_OPEN',
        layer: 'fallback',
        details: {
          service: this.service,
          ...(retryAfterSec !== null && { retryAfterSeconds: retryAfterSec }),
        },
      },
    }
  }

  /**
   * Record a successful upstream response.
   * Resets failure counters and closes the circuit.
   */
  onSuccess(): void {
    this.s.state = 'CLOSED'
    this.s.consecutiveFailures = 0
    this.s.lastFailureAt = null
    this.s.nextProbeAt = null
  }

  /**
   * Record a failed upstream response.
   * Increments the failure counter and trips the breaker when the threshold
   * is reached.  In HALF_OPEN, a single failure immediately re-opens the
   * circuit and resets the cooldown timer.
   */
  onFailure(): void {
    const now = Date.now()
    this.s.consecutiveFailures += 1
    this.s.lastFailureAt = now

    const shouldTrip =
      this.s.state === 'HALF_OPEN' ||
      this.s.consecutiveFailures >= this.config.failureThreshold

    if (shouldTrip) {
      this.s.state = 'OPEN'
      this.s.nextProbeAt = now + this.config.cooldownMs
    }
  }

  /**
   * Returns a read-only snapshot of the current breaker state.
   * Safe to expose in health-check endpoints without leaking internals.
   */
  snapshot(): CircuitBreakerSnapshot {
    return {
      service: this.service,
      state: this.s.state,
      consecutiveFailures: this.s.consecutiveFailures,
      lastFailureAt: this.s.lastFailureAt,
      nextProbeAt: this.s.nextProbeAt,
    }
  }

  /**
   * Resets the breaker to its initial CLOSED state.
   * Intended for use in tests or manual recovery tooling only.
   */
  reset(): void {
    this.s = makeInitialState()
  }
}

// ---------------------------------------------------------------------------
// Per-service singleton registry
// ---------------------------------------------------------------------------

const registry = new Map<GuardrailService, CircuitBreaker>()

/**
 * Returns the singleton `CircuitBreaker` for the given service, creating it
 * on first access.  All callers within the same Node.js process share the
 * same instance, so failure counts accumulate correctly across requests.
 */
export function getCircuitBreaker(
  service: GuardrailService,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): CircuitBreaker {
  let breaker = registry.get(service)
  if (!breaker) {
    breaker = new CircuitBreaker(service, config)
    registry.set(service, breaker)
  }
  return breaker
}

/**
 * Returns a snapshot of all registered circuit breakers.
 * Useful for a `/api/health` endpoint.
 */
export function getAllSnapshots(): CircuitBreakerSnapshot[] {
  return Array.from(registry.values()).map((cb) => cb.snapshot())
}
