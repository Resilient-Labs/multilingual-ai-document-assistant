import type { ChatMessage } from "@/components/chat/chat-thread";
import type { AttachmentChip } from "@/components/chat/chat-composer";
import { QuickSummaryCard } from "@/components/chat/quick-summary-card";

export const mockMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: (
      <p>
        I need to translate a contract from Spanish to English. Can you help me
        understand what requirements or missing information I should check before
        submitting?
      </p>
    ),
  },
  {
    id: "2",
    role: "assistant",
    content: (
      <div className="space-y-4">
        <p>
          I can help you prepare your contract for translation. Based on typical
          document translation workflows, here&apos;s a summary of what to verify:
        </p>
        <QuickSummaryCard
          type="requirements"
          title="Requirements identified"
          items={[
            "Source language: Spanish",
            "Target language: English",
            "Document type: Legal contract",
            "Format: PDF (recommended)",
          ]}
        />
        <QuickSummaryCard
          type="missing"
          title="Information to confirm"
          items={[
            "Signing parties and their roles",
            "Effective date and expiration",
            "Jurisdiction and governing law",
            "Any appendices or exhibits referenced",
          ]}
        />
        <QuickSummaryCard
          type="action"
          title="Next steps"
          items={[
            "Upload or paste the contract text for analysis",
            "Add any images (e.g., signatures, stamps) for context",
            "Specify any sections that need special handling",
          ]}
        />
      </div>
    ),
  },
  {
    id: "3",
    role: "user",
    content: (
      <p>
        I pasted a section from the contract. Can you summarize the key terms and
        flag anything that might be ambiguous for translation?
      </p>
    ),
  },
  {
    id: "4",
    role: "assistant",
    content: (
      <div className="space-y-4">
        <p>
          Here&apos;s a concise summary of the section you shared and potential
          translation considerations:
        </p>
        <QuickSummaryCard
          type="requirements"
          title="Key terms detected"
          items={[
            "Payment terms: 30-day net",
            "Termination clause with 60-day notice",
            "Confidentiality obligations",
          ]}
        />
        <QuickSummaryCard
          type="missing"
          title="Ambiguities to clarify"
          items={[
            '"Material breach" — consider defining in the contract',
            "Currency symbol (€ vs $) — confirm intended currency",
            'References to "Exhibit A" — ensure exhibit is provided',
          ]}
        />
      </div>
    ),
  },
];

export const mockAttachmentChips: AttachmentChip[] = [
  { id: "a1", type: "text", label: "Contract excerpt (Section 4.2)" },
  { id: "a2", type: "image", label: "signature_page.png" },
  { id: "a3", type: "link", label: "https://example.com/terms" },
];
