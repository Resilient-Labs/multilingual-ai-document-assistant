'use client';

//===========For updating a chunk in the EntityDB===============//

import { useState } from "react";
import { getEntityDB, queryChunks } from "@/lib/entitydb";
import { Button } from "@base-ui/react/button";


export default function updateChunk() {
    const [status, setStatus] = useState<"idle" | "querying" | "done" | "error">("idle");

    async function onUpdate() {
        setStatus("querying");
        try {
            const db = getEntityDB();

            // Query chunks from EntityDB, need to use indexedDB to get the id of the chunk
            const chunks = await queryChunks("this is a test text", { limit: 1 });
            
            const idb = await (db as any).dbPromise
            const tx = await idb.transaction("vectors", "readonly")
            const store = tx.objectStore("vectors")
            
            const all = await store.getAll();
            const row = all.find((r: any) => r.docId === chunks[0].docId && r.chunkId === chunks[0].chunkId);
            if (!row?.id) throw new Error("Could not resolve DB record id");
            
            // Test backend communication
            const res = await fetch("/api/test", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fullText: "Updated text" }),
            });
            const data = await res.json();
            setStatus("done");
            await db.delete(row.id);
            await db.insert({
                ...row,
                apiText: data.message,
                updatedAt: Date.now(),
              });
        } catch (error) {
            console.error("Error updating chunk:", error);
        }
    }
    return (
        <div>
            <Button onClick={onUpdate} disabled={status === "querying"}>
                {status === "querying" ? "Querying..." : "Update Chunk"}
            </Button>
        </div>
    );
  
}