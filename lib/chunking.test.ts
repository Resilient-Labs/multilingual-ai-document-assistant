import { describe, it, expect } from "vitest";
import { chunkText } from "./chunking";

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const result = chunkText("Hello world");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("chunk_0");
    expect(result[0].text).toBe("Hello world");
  });

  it("computes tokenCount as ceil(length / 4)", () => {
    const result = chunkText("abcdefghij");
    expect(result[0].tokenCount).toBe(Math.ceil(10 / 4));
  });

  it("trims the single-chunk case", () => {
    const result = chunkText("  padded  ");
    expect(result[0].text).toBe("padded");
  });

  it("produces overlapping chunks for long text", () => {
    const text = "a".repeat(1000);
    const result = chunkText(text, { chunkSize: 500, chunkOverlap: 100 });
    expect(result.length).toBeGreaterThan(1);

    expect(result[0].text.length).toBe(500);
  });

  it("ids are sequential chunk_0, chunk_1, …", () => {
    const text = "x".repeat(1200);
    const result = chunkText(text, { chunkSize: 500, chunkOverlap: 100 });
    result.forEach((c, i) => {
      expect(c.id).toBe(`chunk_${i}`);
    });
  });

  it("covers the full input without gaps", () => {
    const text = "abcdefghij".repeat(100);
    const result = chunkText(text, { chunkSize: 200, chunkOverlap: 50 });
    const lastChunk = result[result.length - 1];
    expect(text).toContain(lastChunk.text);
  });

  it("respects custom chunkSize and chunkOverlap", () => {
    const text = "b".repeat(300);
    const result = chunkText(text, { chunkSize: 100, chunkOverlap: 20 });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].text.length).toBe(100);
  });

  it("uses defaults of 500 / 100 when no options given", () => {
    const text = "c".repeat(600);
    const result = chunkText(text);
    expect(result).toHaveLength(2);
    expect(result[0].text.length).toBe(500);
  });

  it("handles text exactly equal to chunkSize", () => {
    const text = "d".repeat(500);
    const result = chunkText(text);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(text);
  });

  it("stride is at least 1 even when overlap >= chunkSize", () => {
    const text = "e".repeat(20);
    const result = chunkText(text, { chunkSize: 5, chunkOverlap: 100 });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((c) => {
      expect(c.text.length).toBeGreaterThan(0);
    });
  });
});
