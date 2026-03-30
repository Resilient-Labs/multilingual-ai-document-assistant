import { NextResponse, type NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;

interface Window {
  count: number;
  start: number;
}

const counters = new Map<string, Window>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(ip: string, now: number): { limited: boolean; retryAfter: number } {
  const entry = counters.get(ip);

  if (!entry || now - entry.start >= WINDOW_MS) {
    counters.set(ip, { count: 1, start: now });
    return { limited: false, retryAfter: 0 };
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.start + WINDOW_MS - now) / 1000);
    return { limited: true, retryAfter: Math.max(retryAfter, 1) };
  }

  return { limited: false, retryAfter: 0 };
}

export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();

  const ip = clientIp(req);
  const { limited, retryAfter } = isRateLimited(ip, Date.now());

  if (limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/documents/extract", "/api/documents/upload"],
};
