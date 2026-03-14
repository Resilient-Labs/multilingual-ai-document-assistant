'use client';

//===========For adding a example chunk to the EntityDB===============//

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { generateDocumentId } from "@/lib/documentId";

export default function AddExampleChunk() {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function onAdd() {
    setStatus("saving");
    try {
      // lazy import keeps EntityDB path strictly client-event driven
      const { insertChunk } = await import("@/lib/entitydb");
      await insertChunk("This is a test text", {
        docId: generateDocumentId(),
        chunkId: "456",
      });
      setStatus("done");
    } catch (e) {
      console.error("Error adding example chunk:", e);
      setStatus("error");
    }
  }

  return (
    <div>
      <Button onClick={onAdd} disabled={status === "saving"}>
        {status === "saving" ? "Adding..." : "Add Example Chunk"}
      </Button>
      {status === "done" && <p>Chunk added.</p>}
      {status === "error" && <p>Failed to add chunk.</p>}
    </div>
  );
}