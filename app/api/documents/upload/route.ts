import { POST as extractHandler } from "../extract/route";

/**
 * POST /api/documents/upload
 *
 * @deprecated Use POST /api/documents/extract instead.
 * This route delegates to the canonical extraction endpoint and will be
 * removed after 2026-06-27. Callers should migrate to /api/documents/extract.
 */
export async function POST(request: Request) {
  console.warn(
    "[DEPRECATED] POST /api/documents/upload — migrate to /api/documents/extract"
  );

  const response = await extractHandler(request);
  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", "Fri, 27 Jun 2026 00:00:00 GMT");
  response.headers.set(
    "Link",
    '</api/documents/extract>; rel="successor-version"'
  );
  return response;
}
