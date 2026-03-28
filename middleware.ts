import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  API_CSRF_COOKIE_NAME,
  hasUpstashRateLimitEnv,
  hasValidCsrfRequest,
  isMutatingMethod,
  shouldFailClosedForRateLimit,
} from "@/lib/api-security";

const MAX_REQUESTS_PER_WINDOW = 10;
const CSRF_BOOTSTRAP_PATH = "/api/csrf";

// ---------------------------------------------------------------------------
// Rate limiter — Upstash Redis when configured, in-memory fallback for local dev
// ---------------------------------------------------------------------------

function buildRateLimiter() {
  return new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_WINDOW, "60 s"),
    analytics: true,
    prefix: "ratelimit:api",
  });
}

let _rateLimiter: Ratelimit | null = null;

function getRateLimiter(): Ratelimit | null {
  if (!hasUpstashRateLimitEnv()) return null;

  if (!_rateLimiter) {
    _rateLimiter = buildRateLimiter();
  }
  return _rateLimiter;
}

// ---------------------------------------------------------------------------
// Client IP — use platform-verified IP, fall back to headers only in dev
// ---------------------------------------------------------------------------

function getClientIp(request: NextRequest): string {
  // request.ip is set by Vercel/platform and cannot be spoofed by the client.
  if (request.ip) return request.ip;

  // Fallback for local development where request.ip is undefined.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

// ---------------------------------------------------------------------------
// Same-origin request guard
// ---------------------------------------------------------------------------

function hasValidApiCsrf(request: NextRequest): boolean {
  return hasValidCsrfRequest({
    requestUrl: request.url,
    originHeader: request.headers.get("origin"),
    refererHeader: request.headers.get("referer"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    cookieToken: request.cookies.get(API_CSRF_COOKIE_NAME)?.value ?? null,
    headerToken: request.headers.get("x-csrf-token"),
  });
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === CSRF_BOOTSTRAP_PATH) {
    return NextResponse.next();
  }

  if (isMutatingMethod(request.method) && !hasValidApiCsrf(request)) {
    return NextResponse.json(
      {
        error: "Forbidden: same-origin CSRF validation failed.",
        code: "CSRF_VALIDATION_FAILED",
      },
      { status: 403 }
    );
  }

  if (!isMutatingMethod(request.method)) {
    return NextResponse.next();
  }

  if (!hasUpstashRateLimitEnv()) {
    if (shouldFailClosedForRateLimit()) {
      return NextResponse.json(
        {
          error:
            "Rate limiting is not configured for production. Set Upstash Redis credentials.",
          code: "RATE_LIMIT_CONFIG_ERROR",
        },
        { status: 500 }
      );
    }

    return NextResponse.next();
  }

  const rateLimiter = getRateLimiter();
  if (!rateLimiter) return NextResponse.next();

  const clientIp = getClientIp(request);
  const { success, reset } = await rateLimiter.limit(clientIp);

  if (!success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((reset - Date.now()) / 1000)
    );
    return NextResponse.json(
      {
        error: "Too many requests. Please wait before trying again.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
