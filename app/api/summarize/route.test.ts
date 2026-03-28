import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";

function createMockRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

describe("POST /api/summarize", () => {
  it("returns 400 when fullText is missing", async () => {
    const request = createMockRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 413 when fullText exceeds character limit", async () => {
    const request = createMockRequest({
      fullText: "a".repeat(50_001),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.code).toBe("INPUT_TOO_LONG");
  });

  it("returns 200 with summary for valid input", async () => {
    const request = createMockRequest({
      fullText: "This is a test document.",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toBeDefined();
  });
});
