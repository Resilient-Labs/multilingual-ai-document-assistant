/**
 * IndexedDB utilities for client-side session persistence.
 * Object stores: documents, sessions, chatHistory
 *
 * Use in client components only (browser API).
 */

const DB_NAME = "DocumentAssistantDB";
const DB_VERSION = 1;

export const STORES = {
  documents: "documents",
  sessions: "sessions",
  chatHistory: "chatHistory",
} as const;

export type DocumentRecord = {
  docId: string;
  fileName: string;
  mimeType: string;
  createdAt: number;
};

export type SessionRecord = {
  docId: string;
  lastOpened: number;
};

export type ChatMessageRecord = {
  role: "user" | "assistant";
  text: string;
};

export type ChatHistoryRecord = {
  docId: string;
  messages: ChatMessageRecord[];
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.documents)) {
        db.createObjectStore(STORES.documents, { keyPath: "docId" });
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        db.createObjectStore(STORES.sessions, { keyPath: "docId" });
      }
      if (!db.objectStoreNames.contains(STORES.chatHistory)) {
        db.createObjectStore(STORES.chatHistory, { keyPath: "docId" });
      }
    };
  });
}

export async function saveDocument(doc: DocumentRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.documents, "readwrite");
    tx.objectStore(STORES.documents).put(doc);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDocuments(): Promise<DocumentRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.documents, "readonly");
    const req = tx.objectStore(STORES.documents).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result ?? []);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateSession(docId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.sessions, "readwrite");
    tx.objectStore(STORES.sessions).put({ docId, lastOpened: Date.now() });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveChatHistory(
  docId: string,
  messages: ChatMessageRecord[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.chatHistory, "readwrite");
    tx.objectStore(STORES.chatHistory).put({ docId, messages });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getChatHistory(
  docId: string
): Promise<ChatMessageRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.chatHistory, "readonly");
    const req = tx.objectStore(STORES.chatHistory).get(docId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result?.messages ?? []);
    };
    req.onerror = () => reject(req.error);
  });
}
