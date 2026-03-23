/**
 * Extract field candidates from normalized OCR blocks.
 * Derives key/value pairs from common document patterns.
 */

import { v4 as uuidv4 } from "uuid";
import type { OCRBlock, FieldCandidate } from "@/types";

function generateCandidateId(): string {
  return `field_${uuidv4()}`;
}

const KEY_VALUE_PATTERN = /^([A-Za-z][A-Za-z\s]*[A-Za-z]):\s*(.+)$/;

const CURRENCY_PATTERN = /\$[\d,]+\.?\d*/;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

export function extractFieldCandidates(
  documentId: string,
  blocks: OCRBlock[]
): FieldCandidate[] {
  const candidates: FieldCandidate[] = [];

  for (const block of blocks) {
    const text = block.text.trim();

    const keyValueMatch = text.match(KEY_VALUE_PATTERN);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();

      candidates.push({
        id: generateCandidateId(),
        documentId,
        blockId: block.id,
        key,
        value,
        confidence: block.confidence,
      });
    }

    const currencyMatch = text.match(CURRENCY_PATTERN);
    if (currencyMatch) {
      candidates.push({
        id: generateCandidateId(),
        documentId,
        blockId: block.id,
        key: "Amount",
        value: currencyMatch[0],
        confidence: block.confidence ? block.confidence * 0.8 : 0.7,
      });
    }

    const dateMatch = text.match(DATE_PATTERN);
    if (dateMatch) {
      candidates.push({
        id: generateCandidateId(),
        documentId,
        blockId: block.id,
        key: "Date",
        value: dateMatch[0],
        confidence: block.confidence ? block.confidence * 0.8 : 0.7,
      });
    }

    const emailMatch = text.match(EMAIL_PATTERN);
    if (emailMatch) {
      candidates.push({
        id: generateCandidateId(),
        documentId,
        blockId: block.id,
        key: "Email",
        value: emailMatch[0],
        confidence: block.confidence ? block.confidence * 0.9 : 0.85,
      });
    }

    const phoneMatch = text.match(PHONE_PATTERN);
    if (phoneMatch) {
      candidates.push({
        id: generateCandidateId(),
        documentId,
        blockId: block.id,
        key: "Phone",
        value: phoneMatch[0],
        confidence: block.confidence ? block.confidence * 0.85 : 0.75,
      });
    }
  }

  return candidates;
}
