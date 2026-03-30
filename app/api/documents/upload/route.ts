import { POST as extractHandler } from "@/app/api/documents/extract/route";

/**
 * POST /api/documents/upload  (DEPRECATED)
 *
 * Thin wrapper that delegates to the canonical /api/documents/extract handler.
 * Adds Deprecation, Sunset, and Link headers so callers know to migrate.
 */
export async function POST(request: Request) {
  console.warn(
    "[DEPRECATED] POST /api/documents/upload — use /api/documents/extract instead."
  );

  const response = await extractHandler(request);

  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", "2026-09-01");
  response.headers.set(
    "Link",
    '</api/documents/extract>; rel="successor-version"'
  );

  return response;
}
