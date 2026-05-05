/**
 * Wipes app client state for this origin: IndexedDB database `EntityDB`
 * (@babycommando/entity-db), then localStorage and sessionStorage.
 * Browser-only; safe to call from a client component or DevTools after importing the app bundle.
 */
export async function clearAllAppClientStorage(): Promise<void> {
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('EntityDB')
      const finish = () => {
        resolve()
      }
      req.onsuccess = finish
      req.onerror = finish
      req.onblocked = finish
    })
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear()
  }
}
