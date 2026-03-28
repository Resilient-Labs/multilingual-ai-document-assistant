import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

function createMockRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

describe("POST /api/translate", () => {
  const originalEnv = process.env.DEEPL_API_KEY;

  beforeEach(() => {
    process.env.DEEPL_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.DEEPL_API_KEY = originalEnv;
  });

  it("returns 400 when text is missing", async () => {
    const request = createMockRequest({ targetLang: "es" });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 413 when text exceeds character limit", async () => {
    const request = createMockRequest({
      text: "a".repeat(10_001),
      targetLang: "es",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.code).toBe("INPUT_TOO_LONG");
  });

  it("returns 400 for unsupported language", async () => {
    const request = createMockRequest({
      text: "Hello",
      targetLang: "xx",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
