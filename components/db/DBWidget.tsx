'use client';

//===========For displaying the data in the EntityDB===============//

import { useEffect, useState } from "react";
import { getEntityDB, insertChunk } from "@/lib/entitydb";
import { generateDocumentId } from "@/lib/documentId";

export default function DBWidget() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Initial EntityDB setup
        const db = getEntityDB();

        // Get all data for display
        const idb = await (db as any).dbPromise;
        const tx = idb.transaction("vectors", "readonly");
        const store = tx.objectStore("vectors");
        const all = await store.getAll();
        const withoutVectors = all.map(({ vector, ...rest }: any) => rest);
        if (!cancelled) setItems(withoutVectors);

        // Insert test data into EntityDB (straight up)
        // db.insert({text: data.message});

        // SCAM TEAM!!(api token needed for this one)
        // const res = await fetch("/api/safety", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ fullText: "Hello" }),
        // });
        // const data = await res.json();
        // db.insert({flags: data.flags});
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load DB");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (error) return <pre>{error}</pre>;
  return <pre>{JSON.stringify(items, null, 2)}</pre>;
}