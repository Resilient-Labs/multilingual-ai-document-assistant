import { describe, it, expect } from "vitest";
import { extractFieldCandidates } from "./fieldCandidates";
import type { OCRBlock } from "@/types";

function createBlock(text: string, id = "block_1"): OCRBlock {
  return {
    id,
    documentId: "doc_test",
    text,
    confidence: 0.95,
    page: 1,
  };
}

describe("extractFieldCandidates", () => {
  it("extracts key-value pairs from colon-separated text", () => {
    const blocks: OCRBlock[] = [createBlock("Name: John Doe")];

    const candidates = extractFieldCandidates("doc_test", blocks);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].key).toBe("Name");
    expect(candidates[0].value).toBe("John Doe");
  });

  it("assigns unique IDs to candidates", () => {
    const blocks: OCRBlock[] = [
      createBlock("Name: John Doe", "block_1"),
      createBlock("Email: john@example.com", "block_2"),
    ];

    const candidates = extractFieldCandidates("doc_test", blocks);

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    const ids = candidates.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("links candidates to document and block", () => {
    const blocks: OCRBlock[] = [createBlock("Name: John Doe", "block_123")];

    const candidates = extractFieldCandidates("doc_456", blocks);

    expect(candidates[0].documentId).toBe("doc_456");
    expect(candidates[0].blockId).toBe("block_123");
  });

  it("extracts currency amounts", () => {
    const blocks: OCRBlock[] = [createBlock("Total: $1,234.56")];

    const candidates = extractFieldCandidates("doc_test", blocks);

    const amountCandidate = candidates.find((c) => c.key === "Amount");
    expect(amountCandidate).toBeDefined();
    expect(amountCandidate!.value).toBe("$1,234.56");
  });

  it("extracts dates in various formats", () => {
    const blocks: OCRBlock[] = [
      createBlock("Date issued: 2026-03-15", "block_1"),
      createBlock("Due: 03/15/2026", "block_2"),
    ];

    const candidates = extractFieldCandidates("doc_test", blocks);

    const dates = candidates.filter((c) => c.key === "Date");
    expect(dates.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts email addresses", () => {
    const blocks: OCRBlock[] = [createBlock("Contact: user@example.com")];

    const candidates = extractFieldCandidates("doc_test", blocks);

    const emailCandidate = candidates.find((c) => c.key === "Email");
    expect(emailCandidate).toBeDefined();
    expect(emailCandidate!.value).toBe("user@example.com");
  });

  it("extracts phone numbers", () => {
    const blocks: OCRBlock[] = [createBlock("Call us: (555) 123-4567")];

    const candidates = extractFieldCandidates("doc_test", blocks);

    const phoneCandidate = candidates.find((c) => c.key === "Phone");
    expect(phoneCandidate).toBeDefined();
    expect(phoneCandidate!.value).toBe("(555) 123-4567");
  });

  it("preserves confidence from block", () => {
    const blocks: OCRBlock[] = [
      {
        id: "block_1",
        documentId: "doc_test",
        text: "Name: John Doe",
        confidence: 0.85,
        page: 1,
      },
    ];

    const candidates = extractFieldCandidates("doc_test", blocks);

    expect(candidates[0].confidence).toBe(0.85);
  });

  it("returns empty array for blocks without extractable fields", () => {
    const blocks: OCRBlock[] = [createBlock("Just some random text here")];

    const candidates = extractFieldCandidates("doc_test", blocks);

    expect(candidates).toHaveLength(0);
  });

  it("handles multiple fields in one document", () => {
    const blocks: OCRBlock[] = [
      createBlock("Name: Jane Smith", "block_1"),
      createBlock("Date: 2026-01-15", "block_2"),
      createBlock("Amount: $500.00", "block_3"),
      createBlock("Email: jane@example.com", "block_4"),
    ];

    const candidates = extractFieldCandidates("doc_test", blocks);

    expect(candidates.length).toBeGreaterThanOrEqual(4);

    const nameCandidate = candidates.find((c) => c.key === "Name");
    expect(nameCandidate).toBeDefined();
    expect(nameCandidate!.value).toBe("Jane Smith");
  });
});
