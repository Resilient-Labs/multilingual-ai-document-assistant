import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";

function createMockRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

describe("POST /api/ask", () => {
  it("returns 400 when question is missing", async () => {
    const request = createMockRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 413 when question exceeds character limit", async () => {
    const request = createMockRequest({
      question: "a".repeat(1_001),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.code).toBe("INPUT_TOO_LONG");
  });

  it("returns 413 when context exceeds character limit", async () => {
    const request = createMockRequest({
      question: "What is this about?",
      context: "a".repeat(50_001),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.code).toBe("INPUT_TOO_LONG");
  });

  it("returns 413 when chunks joined exceed character limit", async () => {
    const bigChunk = "a".repeat(25_001);
    const request = createMockRequest({
      question: "What is this about?",
      chunks: [bigChunk, bigChunk],
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.code).toBe("INPUT_TOO_LONG");
  });

  it("returns 200 with answer for valid input", async () => {
    const request = createMockRequest({
      question: "What is this?",
      context: "A test document about testing.",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.answer).toBeDefined();
  });
});
