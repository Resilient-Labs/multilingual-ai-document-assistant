import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = globalThis as typeof globalThis & {
  __documentExtractionRateLimit?: Map<string, RateLimitEntry>;
};

function getRateLimitBucket(): Map<string, RateLimitEntry> {
  if (!rateLimitStore.__documentExtractionRateLimit) {
    rateLimitStore.__documentExtractionRateLimit = new Map();
  }

  return rateLimitStore.__documentExtractionRateLimit;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function buildRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "Too many extraction requests. Please wait before trying again.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

export function middleware(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.next();
  }

  const now = Date.now();
  const bucket = getRateLimitBucket();
  const clientIp = getClientIp(request);
  const currentEntry = bucket.get(clientIp);

  if (!currentEntry || now >= currentEntry.resetAt) {
    bucket.set(clientIp, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return NextResponse.next();
  }

  if (currentEntry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((currentEntry.resetAt - now) / 1000)
    );
    return buildRateLimitResponse(retryAfterSeconds);
  }

  currentEntry.count += 1;

  // Opportunistically clean up expired entries to keep memory bounded.
  for (const [ip, entry] of bucket.entries()) {
    if (now >= entry.resetAt) {
      bucket.delete(ip);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/documents/extract", "/api/documents/upload"],
};
