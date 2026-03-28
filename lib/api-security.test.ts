import { describe, expect, it } from "vitest";
import {
  hasUpstashRateLimitEnv,
  hasValidCsrfRequest,
  isAllowedFetchSite,
  isMutatingMethod,
  isSameOriginRequest,
  shouldFailClosedForRateLimit,
} from "./api-security";

describe("api-security", () => {
  describe("isMutatingMethod", () => {
    it("detects mutating HTTP methods case-insensitively", () => {
      expect(isMutatingMethod("POST")).toBe(true);
      expect(isMutatingMethod("patch")).toBe(true);
      expect(isMutatingMethod("GET")).toBe(false);
    });
  });

  describe("hasUpstashRateLimitEnv", () => {
    it("requires both Upstash credentials", () => {
      expect(
        hasUpstashRateLimitEnv({
          UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
          UPSTASH_REDIS_REST_TOKEN: "token",
        })
      ).toBe(true);

      expect(
        hasUpstashRateLimitEnv({
          UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
          UPSTASH_REDIS_REST_TOKEN: "",
        })
      ).toBe(false);
    });
  });

  describe("shouldFailClosedForRateLimit", () => {
    it("fails closed only in production", () => {
      expect(shouldFailClosedForRateLimit("production")).toBe(true);
      expect(shouldFailClosedForRateLimit("development")).toBe(false);
    });
  });

  describe("isSameOriginRequest", () => {
    it("accepts matching origin headers", () => {
      expect(
        isSameOriginRequest(
          "https://app.example.com/api/translate",
          "https://app.example.com",
          null
        )
      ).toBe(true);
    });

    it("falls back to referer when origin is missing", () => {
      expect(
        isSameOriginRequest(
          "https://app.example.com/api/translate",
          null,
          "https://app.example.com/translate/doc-1"
        )
      ).toBe(true);
    });

    it("rejects cross-origin requests", () => {
      expect(
        isSameOriginRequest(
          "https://app.example.com/api/translate",
          "https://evil.example.com",
          null
        )
      ).toBe(false);
    });
  });

  describe("isAllowedFetchSite", () => {
    it("accepts same-origin fetch metadata and rejects cross-site", () => {
      expect(isAllowedFetchSite("same-origin")).toBe(true);
      expect(isAllowedFetchSite("none")).toBe(true);
      expect(isAllowedFetchSite("cross-site")).toBe(false);
    });
  });

  describe("hasValidCsrfRequest", () => {
    it("accepts matching token pair from the same origin", () => {
      expect(
        hasValidCsrfRequest({
          requestUrl: "https://app.example.com/api/summarize",
          originHeader: "https://app.example.com",
          refererHeader: null,
          secFetchSite: "same-origin",
          cookieToken: "token-123",
          headerToken: "token-123",
        })
      ).toBe(true);
    });

    it("rejects missing or mismatched tokens", () => {
      expect(
        hasValidCsrfRequest({
          requestUrl: "https://app.example.com/api/summarize",
          originHeader: "https://app.example.com",
          refererHeader: null,
          secFetchSite: "same-origin",
          cookieToken: "token-123",
          headerToken: "token-456",
        })
      ).toBe(false);
    });

    it("rejects cross-site requests even with matching tokens", () => {
      expect(
        hasValidCsrfRequest({
          requestUrl: "https://app.example.com/api/summarize",
          originHeader: "https://evil.example.com",
          refererHeader: null,
          secFetchSite: "cross-site",
          cookieToken: "token-123",
          headerToken: "token-123",
        })
      ).toBe(false);
    });
  });
});
