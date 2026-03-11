'use client'

// import { getEntityDB, queryChunks } from "@/lib/entitydb";
// import { useEffect } from "react";  
// export function TestComp() {
//   const db = getEntityDB();
// //   console.log(db);
//   const results = queryChunks("Hello", { limit: 5 });
//   console.log(results);
//   return <div>Results: {results.map((result) => result.text).join(", ")}</div>;
// }

import { queryChunks, getEntityDB } from "@/lib/entitydb";
import { useEffect, useState } from "react";import { POST } from "@/app/api/safety/route";

type QueryResults = Awaited<ReturnType<typeof queryChunks>>;

export function TestComp() {
    const [items, setItems] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const db = getEntityDB();

          //INDEXED DB STUFF
          // EntityDB uses `idb` under the hood; `dbPromise` resolves to the IDB instance.
          const idb = await (db as any).dbPromise;
          const tx = idb.transaction('vectors', 'readonly');
          const store = tx.objectStore('vectors');
          const all = await store.getAll();

          // Optional: don’t render huge embedding vectors
          const withoutVectors = all.map(({ vector, ...rest }: any) => rest);
          if (!cancelled) setItems(withoutVectors);
        } catch (e: any) {
          if (!cancelled) setError(e?.message ?? 'Failed to load DB');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);
    if (error) return <pre>{error}</pre>;
    return (
      <div>
        <div>Records: {items.length}</div>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(items, null, 2)}
        </pre>
      </div>
    );
  
}
