/**
 * Authenticated fetch wrapper for internal API routes.
 * Injects the x-api-key header required by middleware auth guard.
 * Use this instead of raw fetch() for all /api/* calls.
 */

const API_KEY = process.env.NEXT_PUBLIC_API_SECRET_KEY ?? "";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export function apiFetch(input: FetchInput, init: FetchInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-api-key", API_KEY);

  return fetch(input, { ...init, headers });
}
