/**
 * Same-origin fetch wrapper for internal API routes.
 * Bootstraps and injects the CSRF token required by the middleware guard.
 * Use this instead of raw fetch() for all /api/* calls.
 */

import { API_CSRF_COOKIE_NAME, isMutatingMethod } from "@/lib/api-security";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

let csrfBootstrapPromise: Promise<string> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }

  return null;
}

async function ensureCsrfToken(): Promise<string> {
  const existingToken = readCookie(API_CSRF_COOKIE_NAME);
  if (existingToken) return existingToken;

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch("/api/csrf", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`CSRF bootstrap failed (${response.status})`);
        }

        const payload = (await response.json()) as { csrfToken?: string };
        return payload.csrfToken ?? readCookie(API_CSRF_COOKIE_NAME) ?? "";
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

export async function apiFetch(
  input: FetchInput,
  init: FetchInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = init.method ?? "GET";

  if (isMutatingMethod(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "same-origin",
  });
}
