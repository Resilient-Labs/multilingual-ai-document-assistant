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

/** The metadata field used to identify the extracted-document record. */
const EXTRACTED_DOCUMENT_KEY = "extracted_document" as const;

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
          const { id: _id, vector: _vector, entityKey: _key, ...payload } = match;
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
