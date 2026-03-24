"use client";

/**
 * useDocumentSession — retrieves the canonical extracted document from the
 * local EntityDB IndexedDB store on mount.
 *
 * Storage convention: records stored with { entityKey: "extracted_document", ...docData }.
 * EntityDB uses an auto-increment numeric IDB key; we identify the target record
 * by the metadata field `entityKey` rather than by the IDB key itself.
 *
 * We access the raw IDB connection via EntityDB's public `dbPromise` property to
 * avoid triggering the ML embedding pipeline (which `insert`/`query` would do).
 */

import { useEffect, useState } from "react";
import type { EntityDB } from "@babycommando/entity-db";
import { getEntityDB } from "@/lib/entitydb";
import type { CanonicalDocument } from "@/types/CanonicalDocument";

// 🟡 [PRINCIPAL] Architecture: Duplicated constant — also exists as EXTRACTED_DOCUMENT_ENTITY_KEY
//    in lib/entitydb-persist.ts. Import from single source of truth to avoid drift.
/** The metadata field used to identify the extracted-document record. */
const EXTRACTED_DOCUMENT_KEY = "extracted_document" as const;

// 🟡 [PRINCIPAL] Architecture: Duplicated interface — identical EntityDBInternal exists
//    in lib/entitydb-persist.ts. Extract to shared types/entitydb.ts.
/** Internal shape of the EntityDB instance to access the raw IDB promise. */
interface EntityDBInternal {
  dbPromise: Promise<{
    transaction(
      store: string,
      mode: "readonly" | "readwrite"
    ): {
      objectStore(name: string): {
        getAll(): Promise<Array<Record<string, unknown>>>;
      };
    };
  }>;
}

export interface UseDocumentSessionResult {
  data: CanonicalDocument | null;
  loading: boolean;
  error: string | null;
}

const IS_BROWSER = typeof window !== "undefined";

export function useDocumentSession(
  sessionId?: string
): UseDocumentSessionResult {
  const [data, setData] = useState<CanonicalDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(IS_BROWSER);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_BROWSER) return;

    setData(null);
    setError(null);
    setLoading(true);

    let cancelled = false;

    async function fetchDocument(): Promise<void> {
      try {
        const entityDB: EntityDB = getEntityDB();
        const internal = entityDB as unknown as EntityDBInternal;
        const idb = await internal.dbPromise;

        const tx = idb.transaction("vectors", "readonly");
        const store = tx.objectStore("vectors");
        const records = await store.getAll();

        if (cancelled) return;

        const match = records.find((r) => {
          if (r["entityKey"] !== EXTRACTED_DOCUMENT_KEY) return false;
          if (sessionId) {
            const doc = r["document"] as { id?: string } | undefined;
            return doc?.id === sessionId;
          }
          return true;
        });

        if (!match) {
          setData(null);
        } else {
          const payload = { ...match };
          delete payload.id;
          delete payload.vector;
          delete payload.entityKey;
          delete payload.text;
          setData(payload as unknown as CanonicalDocument);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to read document from local store";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDocument();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { data, loading, error };
}

/* ═══════════════════════════════════════════
   PRINCIPAL ENGINEER AUDIT — useDocumentSession.ts 2026-03-24
   🔴 High: 0  🟡 Medium: 2  🔵 Low: 0
   ═══════════════════════════════════════════
   
   Summary:
   - EXTRACTED_DOCUMENT_KEY duplicated (also in lib/entitydb-persist.ts)
   - EntityDBInternal interface duplicated (also in lib/entitydb-persist.ts)
   
   ✅ Good patterns observed:
   - Proper useEffect cleanup with cancellation flag
   - Correct dependency array [sessionId]
   - Single responsibility
*/
