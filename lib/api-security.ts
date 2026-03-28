export const API_CSRF_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-api-csrf" : "api-csrf";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"]);

type CsrfValidationInput = {
  requestUrl: string;
  originHeader: string | null;
  refererHeader: string | null;
  secFetchSite: string | null;
  cookieToken: string | null;
  headerToken: string | null;
};

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function hasUpstashRateLimitEnv(
  env?: {
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
  }
): boolean {
  const source = env ?? process.env;
  return Boolean(
    source.UPSTASH_REDIS_REST_URL && source.UPSTASH_REDIS_REST_TOKEN
  );
}

export function shouldFailClosedForRateLimit(env = process.env.NODE_ENV): boolean {
  return env === "production";
}

export function isSameOriginRequest(
  requestUrl: string,
  originHeader: string | null,
  refererHeader: string | null
): boolean {
  const expectedOrigin = new URL(requestUrl).origin;

  if (originHeader) {
    return originHeader === expectedOrigin;
  }

  if (!refererHeader) {
    return false;
  }

  try {
    return new URL(refererHeader).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function isAllowedFetchSite(secFetchSite: string | null): boolean {
  return !secFetchSite || ALLOWED_FETCH_SITES.has(secFetchSite);
}

export function hasValidCsrfRequest({
  requestUrl,
  originHeader,
  refererHeader,
  secFetchSite,
  cookieToken,
  headerToken,
}: CsrfValidationInput): boolean {
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return false;
  }

  return (
    isSameOriginRequest(requestUrl, originHeader, refererHeader) &&
    isAllowedFetchSite(secFetchSite)
  );
}
