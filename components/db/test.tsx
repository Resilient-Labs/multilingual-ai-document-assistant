'use client'
import { insertChunk, queryChunks, getEntityDB } from "@/lib/entitydb";
import { generateDocumentId } from "@/lib/documentId";

export function MyComponent({ text }: { text: string }) {
  async function onClick() {
    // await insertChunk(text, { docId: generateDocumentId(), chunkId: "c1" });
    const res = await fetch("/api/safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullText: text }),
    });
    const data = await res.json();
    console.log(data);
    console.log("Indexed");
    const db = getEntityDB();
      await db.insert({
        text: data.explanation ?? `${data.category} (${data.severity})`,
        entityType: "RiskFlag",
        ...data,
      });
  }
  return <button onClick={onClick}>Index</button>;
}