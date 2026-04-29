// #region agent log
fetch("http://127.0.0.1:7368/ingest/6cae3c54-0e69-499b-9572-025f7397e853", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e45ed" },
  body: JSON.stringify({
    sessionId: "8e45ed",
    runId: "router-invariant",
    hypothesisId: "I",
    location: "cypress/mocks/next-navigation.ts:1",
    message: "Loaded Cypress next/navigation mock module",
    data: {},
    timestamp: Date.now(),
  }),
}).catch(() => {})
// #endregion

export const useRouter = () => {
  // #region agent log
  fetch("http://127.0.0.1:7368/ingest/6cae3c54-0e69-499b-9572-025f7397e853", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e45ed" },
    body: JSON.stringify({
      sessionId: "8e45ed",
      runId: "router-invariant",
      hypothesisId: "I",
      location: "cypress/mocks/next-navigation.ts:18",
      message: "Called mocked useRouter",
      data: {},
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return {
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
  }
}
  
  export const usePathname = () => '/'
  export const useSearchParams = () => new URLSearchParams()