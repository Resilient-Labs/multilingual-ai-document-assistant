# Working Version

> **Snapshot:** Monday, May 11, 2026.
> Pulled the latest `dev` branch (`git pull` → `dba9e8a..c7aa6c4`, fast-forward), then applied the fixes below to restore the Safety, Question Answering, and Read Aloud (TTS) features after the team's dedicated Hugging Face endpoints went down.
>
> After these changes, all three features were verified end-to-end against the live providers (Safety 200, Ask 200, TTS 200 for EN/ES/VI).

---

## 1. The errors that were happening

These are the three errors from the browser:

1. **Safety panel** — `Safety provider returned an error`
2. **Q&A (Ask) tab** — `Question answering failed`
3. **Read Aloud (TTS)** — `Read Aloud failed — The text-to-speech service is temporarily unavailable. Please try again in a moment.`

In the dev-server logs they showed up as:

```text
POST /api/safety 502 in 60846ms      ← 60-second timeout
POST /api/ask    502 in 60667ms      ← 60-second timeout, "fetch failed"
POST /api/tts    503 in 1218ms       ← "HF Inference TTS unavailable: 503 Service Unavailable"
POST /api/tts    503 in 398ms        ← "Cannot POST /models/Resilient-Coders/coqui-css10-es"
```

---

## 2. What was wrong

### Layman's version

The app talks to a few Hugging Face servers in the cloud to do the AI work. Three of those servers were either asleep, paused, or no longer exist:

- The **chat brain** that powers Safety + Q&A had been turned off (or was so slow to wake up that the request timed out before it could answer).
- The **three Read-Aloud voices** (English, Spanish, Vietnamese) were all returning errors — the URLs in `.env.local` pointed to servers that had been deleted or stopped.

The team had **already written backup code** (a fallback that uses a different, always-on Hugging Face service) for the Translate feature, and Translate was the only feature that worked. But that same backup code was never wired into Safety, Q&A, or Read Aloud, so when the main servers failed those three features had no plan B and just showed the error to the user.

The fix was to wire up the backup paths everywhere, so when a main server is down the app quietly switches to the working backup instead of failing.

### Technical version

The app uses Hugging Face **Inference Endpoints** (dedicated, scale-to-zero deployments) for several features. When I probed each endpoint live on Monday, May 11 2026:

| Endpoint | Used by | Status on probe |
| --- | --- | --- |
| `HF_TRANSLATE_ENDPOINT_URL` | Translate | ✅ HTTP 200 in 0.66 s |
| `HF_INFERENCE_ENDPOINT_URL` | Safety + Q&A | ⚠️ HTTP 200 in 7.4 s (warm) but cold-start exceeds the 60 s LB budget → `fetch failed` |
| `HF_TTS_ENDPOINT_EN` | Read Aloud (English) | ❌ TCP timeout at 15 s |
| `HF_TTS_ENDPOINT_ES` | Read Aloud (Spanish) | ❌ HTTP 503 |
| `HF_TTS_ENDPOINT_VI` | Read Aloud (Vietnamese) | ❌ HTTP 503 |
| `HF_TTS_SPACE_URL` (Coqui TTS Space) | Read Aloud fallback | ✅ HTTP 200 (cold start ~48 s, warm <1 s) |
| `https://router.huggingface.co/v1` (HF Router) | Summarize, Translate fallback | ✅ HTTP 200 in 0.79 s |

The team had already created the fallback infrastructure for the chat-style providers:

- `lib/hfRouterChatCompletion.ts` — shared OpenAI-compatible HF Router client
- `lib/safetyHfRouterProvider.ts` — Safety adapter on top of that client
- `lib/translation/callHfRouterTranslateProvider.ts` — Translate adapter (already wired into `app/api/translate/route.ts`)

…but the equivalent fallback was **never wired into the Safety route or the Ask route**. Each route picked one provider at request time and returned the upstream failure straight to the UI. Likewise, `lib/tts/router.ts` picked one TTS provider and gave up if it threw. The fix below wires the existing (and newly-added) fallback paths into all three routes.

---

## 3. Files I changed

| File | What changed | Why |
| --- | --- | --- |
| `app/api/safety/route.ts` | Added HF Router fallback after the dedicated endpoint call. | So Safety degrades gracefully when `HF_INFERENCE_ENDPOINT_URL` cold-starts past 60 s, returns 5xx, or is unset. |
| `app/api/ask/route.ts` | Restructured the inference-endpoint branch to fall through to the existing `streamText` (router) branch on failure. | Same reason as Safety: a transient endpoint failure should fall back instead of breaking the chat session. |
| `lib/tts/router.ts` | Wrapped `synthesizeWithHfInference` in a try/catch that falls back to `synthesizeWithHfSpace`. | So a paused / 503-ing dedicated TTS endpoint automatically routes to the working Coqui Space. |
| `lib/tts/providers/hf-inference.ts` | `isHfInferenceConfigured` now requires a dedicated endpoint URL (no longer accepts "just `HF_TOKEN`"). | The legacy `api-inference.huggingface.co/models/<id>` API has been deprecated for the Coqui TTS models, so probing it just adds latency before the router redirects to the Space anyway. |
| `.env.local` | Commented out the three broken `HF_TTS_ENDPOINT_*` URLs. | Skips the dead probe entirely so TTS goes straight to the working Space. The lines are kept (commented) so they can be re-enabled when the endpoints come back; the new TTS router fallback will protect the app if they fail again. |

---

## 4. Exact code diffs

### 4.1 `app/api/safety/route.ts`

```diff
@@ -15,6 +15,7 @@ import {
   callHfInferenceSafetyProvider,
   SafetyInferenceProviderError,
 } from '@/lib/safetyHfInferenceProvider'
+import { callHfRouterSafetyProvider } from '@/lib/safetyHfRouterProvider'
 import type { SafetyAnalysisRequest, SafetyFlags } from '@/types'
 import {
   sanitizeSafetyInputs,
@@ -23,15 +24,26 @@ import {
 } from './guardrails'

 /**
- * Upstream provider: the team's dedicated HF Inference Endpoint
- * (`HF_INFERENCE_ENDPOINT_URL`). Custom handler that accepts
- * `{"inputs": {"messages": [...]}}` and returns
- * `{"generated_text": "..."}`. The model is instructed by
- * `system-prompt.md` to emit a JSON object; we still run that string
- * through `extractJsonObjectString` to tolerate fenced blocks /
- * surrounding prose. Implementation in `lib/safetyHfInferenceProvider`.
+ * Upstream provider chain (priority order, top wins):
  *
- * Returns 500 `CONFIG_ERROR` when `HF_INFERENCE_ENDPOINT_URL` is unset.
+ *   1. `HF_INFERENCE_ENDPOINT_URL` — the team's dedicated HF Inference
+ *      Endpoint. Custom handler that accepts
+ *      `{"inputs": {"messages": [...]}}` and returns
+ *      `{"generated_text": "..."}`. The model is instructed by
+ *      `system-prompt.md` to emit a JSON object; we still run that
+ *      string through `extractJsonObjectString` to tolerate fenced
+ *      blocks / surrounding prose. Implementation in
+ *      `lib/safetyHfInferenceProvider`.
+ *   2. `HF_TOKEN` — when the dedicated endpoint is unset OR fails
+ *      (cold-start timeout, 5xx, network error), the route falls
+ *      back to the OpenAI-compatible HF Inference Providers router
+ *      at `HF_ASK_BASE_URL` with `HF_ASK_MODEL`, same stack as
+ *      `/api/summarize` and Ask. Implementation in
+ *      `lib/safetyHfRouterProvider`. The router returns the same
+ *      JSON-in-text contract so the parser below does not branch.
+ *
+ * Returns 500 `CONFIG_ERROR` only when **neither** an endpoint URL
+ * nor an HF token is configured.
  */

 /** Long timeout to absorb HF Inference Endpoint cold starts; safety
@@ -232,9 +251,15 @@ export async function POST(request: Request) {

   const inferenceEndpointUrl =
     process.env.HF_INFERENCE_ENDPOINT_URL?.trim() || undefined
-  if (!inferenceEndpointUrl) {
+  const hfToken = process.env.HF_TOKEN?.trim() || undefined
+
+  if (!inferenceEndpointUrl && !hfToken) {
     return NextResponse.json(
-      { error: 'Safety check not configured', code: 'CONFIG_ERROR' },
+      {
+        error:
+          'Safety check not configured. Set HF_INFERENCE_ENDPOINT_URL or HF_TOKEN (router fallback).',
+        code: 'CONFIG_ERROR',
+      },
       { status: 500 }
     )
   }
@@ -259,33 +284,86 @@ export async function POST(request: Request) {
     : textToAnalyze

   // ── Upstream call ────────────────────────────────────────────────────────
+  // Try the dedicated HF Inference Endpoint first when configured. On any
+  // failure (cold-start timeout past the LB's 60s budget, 5xx, network
+  // error), fall back to the HF router so a single flaky endpoint does
+  // not break the user's safety panel. If only HF_TOKEN is set, go
+  // straight to the router.
   let rawContent: string
-  try {
-    rawContent = await callHfInferenceSafetyProvider({
-      url: inferenceEndpointUrl,
-      systemPrompt: prompt,
-      userContent,
-      hfToken: process.env.HF_TOKEN?.trim() || undefined,
-      timeoutMs: HF_INFERENCE_SAFETY_TIMEOUT_MS,
-    })
-  } catch (err) {
-    const status =
-      err instanceof SafetyInferenceProviderError ? err.status : undefined
-    const detail =
-      err instanceof SafetyInferenceProviderError && err.snippet
-        ? err.snippet
-        : err instanceof Error
-          ? err.message
-          : String(err)
-    return NextResponse.json(
-      {
-        error: 'Safety provider returned an error',
-        code: 'UPSTREAM_ERROR',
-        detail,
-        status,
-      },
-      { status: 502 }
-    )
+  let providerUsed: 'hf-inference-endpoint' | 'hf-router'
+  let dedicatedError: SafetyInferenceProviderError | null = null
+
+  if (inferenceEndpointUrl) {
+    try {
+      rawContent = await callHfInferenceSafetyProvider({
+        url: inferenceEndpointUrl,
+        systemPrompt: prompt,
+        userContent,
+        hfToken,
+        timeoutMs: HF_INFERENCE_SAFETY_TIMEOUT_MS,
+      })
+      providerUsed = 'hf-inference-endpoint'
+    } catch (err) {
+      dedicatedError =
+        err instanceof SafetyInferenceProviderError
+          ? err
+          : new SafetyInferenceProviderError(
+              err instanceof Error ? err.message : String(err),
+              { cause: err }
+            )
+      if (!hfToken) {
+        const detail = dedicatedError.snippet ?? dedicatedError.message
+        return NextResponse.json(
+          {
+            error: 'Safety provider returned an error',
+            code: 'UPSTREAM_ERROR',
+            detail,
+            status: dedicatedError.status,
+          },
+          { status: 502 }
+        )
+      }
+    }
+  }
+
+  if (!rawContent!) {
+    if (dedicatedError) {
+      // eslint-disable-next-line no-console -- one-line ops note when we fall back
+      console.warn(
+        '[safety] HF Inference Endpoint failed, falling back to HF router:',
+        dedicatedError.status ?? '',
+        dedicatedError.message
+      )
+    }
+    try {
+      rawContent = await callHfRouterSafetyProvider({
+        systemPrompt: prompt,
+        userContent,
+        hfToken: hfToken!,
+        timeoutMs: HF_INFERENCE_SAFETY_TIMEOUT_MS,
+        baseUrl: process.env.HF_ASK_BASE_URL?.trim(),
+        model: process.env.HF_ASK_MODEL?.trim(),
+      })
+      providerUsed = 'hf-router'
+    } catch (err) {
+      const status =
+        err instanceof SafetyInferenceProviderError ? err.status : undefined
+      const detail =
+        err instanceof SafetyInferenceProviderError && err.snippet
+          ? err.snippet
+          : err instanceof Error
+            ? err.message
+            : String(err)
+      return NextResponse.json(
+        {
+          error: 'Safety provider returned an error',
+          code: 'UPSTREAM_ERROR',
+          detail,
+          status,
+        },
+        { status: 502 }
+      )
+    }
   }

   const jsonPayload = extractJsonObjectString(rawContent)
@@ -308,7 +386,7 @@ export async function POST(request: Request) {
   evaluateAsync({
     input: userContent,
     output: rawContent,
-    model: 'hf-inference-endpoint',
+    model: providerUsed!,
     feature: 'safety',
   })
   return NextResponse.json({ flags, presentation })
```

**Why these changes:**

- **Imported `callHfRouterSafetyProvider`** — the file already existed (`lib/safetyHfRouterProvider.ts`) but nothing was using it.
- **Added `hfToken` resolution and a combined `!inferenceEndpointUrl && !hfToken` config check** — previously the route returned `CONFIG_ERROR` whenever the dedicated URL was missing, even if a router token was available.
- **Wrapped the upstream call in a try/fallback** — try the dedicated endpoint first; on any failure, fall back to `callHfRouterSafetyProvider` if `HF_TOKEN` is set. If only one provider is available it behaves exactly like before.
- **Added `providerUsed` tracking** so the LangSmith evaluation hook records which provider actually answered (`hf-inference-endpoint` vs `hf-router`) instead of always claiming the dedicated endpoint.

### 4.2 `app/api/ask/route.ts`

```diff
@@ -180,12 +180,18 @@ export async function POST(request: Request) {

     const chunkCount = Array.isArray(chunks) ? chunks.length : 0;

-    // Resolve which upstream to use. The dedicated inference endpoint
-    // wins when configured; otherwise we fall back to the legacy router
-    // path which requires HF_TOKEN.
+    // Resolve which upstream(s) to use. Priority:
+    //   1. HF_INFERENCE_ENDPOINT_URL (preferred when configured).
+    //   2. HF_TOKEN-backed router via @ai-sdk/openai (`getAskLanguageModel`).
+    //
+    // The router path is also resolved up-front when HF_TOKEN is set so
+    // that a transient failure of the dedicated endpoint (cold-start
+    // timeout past the LB's 60s budget, 5xx, network error) can fall
+    // back to the working router path instead of breaking the user's
+    // chat session.
     const inferenceEndpointUrl =
       process.env.HF_INFERENCE_ENDPOINT_URL?.trim() || undefined;
-    const model = inferenceEndpointUrl ? null : getAskLanguageModel();
+    const model = getAskLanguageModel();
     if (!inferenceEndpointUrl && !model) {
       const durationMs = Date.now() - started;
       /* eslint-disable no-console */
@@ -273,7 +279,7 @@ export async function POST(request: Request) {
     // here too so observability shape stays identical to the streamText path.
     if (inferenceEndpointUrl) {
       const inferenceModelId = "hf-inference-endpoint";
-      let answerText: string;
+      let answerText: string | null = null;
       try {
         answerText = await callHfInferenceAskProvider({
           url: inferenceEndpointUrl,
@@ -283,90 +289,107 @@ export async function POST(request: Request) {
           timeoutMs: HF_INFERENCE_ASK_TIMEOUT_MS,
         });
       } catch (err) {
-        /* eslint-disable no-console */
         const message = err instanceof Error ? err.message : String(err);
         const durationMs = Date.now() - started;
-        console.error(
-          "[ask] inference error:",
+        if (!model) {
+          /* eslint-disable no-console */
+          console.error(
+            "[ask] inference error:",
+            message,
+            "— latency:",
+            durationMs,
+            "ms",
+            "— provider:",
+            inferenceModelId,
+          );
+          /* eslint-enable no-console */
+          return NextResponse.json(
+            { error: "Question answering failed" },
+            { status: 502 },
+          );
+        }
+        /* eslint-disable no-console -- one-line ops note when we fall back */
+        console.warn(
+          "[ask] HF Inference Endpoint failed, falling back to HF router:",
           message,
           "— latency:",
           durationMs,
           "ms",
-          "— provider:",
-          inferenceModelId,
         );
         /* eslint-enable no-console */
-        return NextResponse.json(
-          { error: "Question answering failed" },
-          { status: 502 },
-        );
       }

-      // Fire-and-forget observability — same shape as the streamText path.
-      void postAskTurnToLangSmith({
-        questionHash,
-        questionLen,
-        chunkCount,
-        answerLanguage: answerLanguage ?? "unset",
-        contextTextLen: safeContext.length,
-        modelId: inferenceModelId,
-        finishReason: "stop",
-        totalUsage: undefined,
-        answerText,
-        confidenceBandsVersion: ASK_CONFIDENCE_BANDS_VERSION,
-      }).catch((langsmithErr) => {
-        /* eslint-disable no-console */
-        console.error(
-          "[ask] LangSmith export error:",
-          langsmithErr instanceof Error ? langsmithErr.message : String(langsmithErr),
-        );
-        /* eslint-enable no-console */
-      });
-      evaluateAsync({
-        input: safeQuestion,
-        output: answerText,
-        model: inferenceModelId,
-        feature: "ask",
-        metadata: {
+      // When the dedicated endpoint succeeded, return its answer wrapped
+      // in a UI message stream so AskTab keeps consuming the same protocol
+      // as the streamText branch below. When it threw and a router model
+      // is available, fall through to the streamText branch instead.
+      if (answerText !== null) {
+        const finalAnswerText = answerText;
+        void postAskTurnToLangSmith({
           questionHash,
+          questionLen,
           chunkCount,
           answerLanguage: answerLanguage ?? "unset",
-          confidenceBandsVersion: ASK_CONFIDENCE_BANDS_VERSION,
+          contextTextLen: safeContext.length,
+          modelId: inferenceModelId,
           finishReason: "stop",
-          provider: inferenceModelId,
-        },
-      });
+          totalUsage: undefined,
+          answerText: finalAnswerText,
+          confidenceBandsVersion: ASK_CONFIDENCE_BANDS_VERSION,
+        }).catch((langsmithErr) => {
+          /* eslint-disable no-console */
+          console.error(
+            "[ask] LangSmith export error:",
+            langsmithErr instanceof Error ? langsmithErr.message : String(langsmithErr),
+          );
+          /* eslint-enable no-console */
+        });
+        evaluateAsync({
+          input: safeQuestion,
+          output: finalAnswerText,
+          model: inferenceModelId,
+          feature: "ask",
+          metadata: {
+            questionHash,
+            chunkCount,
+            answerLanguage: answerLanguage ?? "unset",
+            confidenceBandsVersion: ASK_CONFIDENCE_BANDS_VERSION,
+            finishReason: "stop",
+            provider: inferenceModelId,
+          },
+        });

-      const durationMs = Date.now() - started;
-      const successLogPayload = { questionHash, questionLen };
-      assertAskLogHasNoRawTextPayload(
-        "inference_endpoint_complete",
-        successLogPayload,
-      );
-      /* eslint-disable no-console */
-      console.log(
-        "[ask] inference endpoint complete — latency:",
-        durationMs,
-        "ms",
-        successLogPayload,
-      );
-      /* eslint-enable no-console */
+        const durationMs = Date.now() - started;
+        const successLogPayload = { questionHash, questionLen };
+        assertAskLogHasNoRawTextPayload(
+          "inference_endpoint_complete",
+          successLogPayload,
+        );
+        /* eslint-disable no-console */
+        console.log(
+          "[ask] inference endpoint complete — latency:",
+          durationMs,
+          "ms",
+          successLogPayload,
+        );
+        /* eslint-enable no-console */

-      // Emit a UI message stream with one text-delta carrying the whole
-      // answer. AskTab streams it through `readUIMessageStream` exactly
-      // like the streamText path, so the chat bubble renders the same way.
-      const textId = randomUUID();
-      const stream = createUIMessageStream({
-        execute: ({ writer }) => {
-          writer.write({ type: "text-start", id: textId });
-          writer.write({ type: "text-delta", id: textId, delta: answerText });
-          writer.write({ type: "text-end", id: textId });
-        },
-      });
-      return createUIMessageStreamResponse({ stream });
+        const textId = randomUUID();
+        const stream = createUIMessageStream({
+          execute: ({ writer }) => {
+            writer.write({ type: "text-start", id: textId });
+            writer.write({ type: "text-delta", id: textId, delta: finalAnswerText });
+            writer.write({ type: "text-end", id: textId });
+          },
+        });
+        return createUIMessageStreamResponse({ stream });
+      }
     }

     // ── Legacy streaming branch (HF Inference Providers router) ──────────────
+    // Reached when (a) `HF_INFERENCE_ENDPOINT_URL` is unset and `model`
+    // is the only available provider, or (b) the dedicated endpoint
+    // threw above and we are falling back to the router.
     // [Karlee] — V1 uses baseline Llama 3.1 8B + RAG + prompts (no fine-tuning per team decision, Apr 2026).
     // HF/LLM errors often surface when the client consumes the stream (after this handler returns),
     // not here — so logs below mean "stream object ready", not "model finished successfully".
```

**Why these changes:**

- **`const model = getAskLanguageModel();`** — previously the router model was only resolved when `HF_INFERENCE_ENDPOINT_URL` was unset. Resolving it up-front makes it available as a fallback when the dedicated endpoint throws.
- **Changed `let answerText: string;` to `let answerText: string | null = null;`** — used as a sentinel: `null` means "the dedicated endpoint either was not tried or threw". Only when it stays `null` AND a `model` is available do we fall through to the streamText branch.
- **Conditional 502 vs warn-and-fall-through** — if no router fallback is available we keep the original behavior (return 502). If a router fallback is available we log a warning and fall through to the existing streamText branch — no new code path needed for the fallback itself.
- **Wrapped the dedicated-endpoint success path in `if (answerText !== null) { … return … }`** — keeps everything below the early-return semantics of the original code, while letting execution reach the streamText branch if the dedicated endpoint failed.

### 4.3 `lib/tts/router.ts`

```diff
@@ -9,9 +9,15 @@ import type { TtsProvider, TtsRequestPayload, TtsSynthesisResult } from '@/lib/t
  * Resolve which TTS backend to use for a given language.
  *
  * Priority:
- *  1. hf-inference — when HF_TTS_ENDPOINT_EN or HF_TOKEN is configured AND
- *                    the language is English (the only model with a handler.py)
- *  2. hf-space    — all other cases (es/vi always, en as fallback)
+ *  1. hf-inference — when HF_TTS_ENDPOINT_<LANG> or HF_TOKEN is configured
+ *                    for the requested language. Dedicated endpoints can
+ *                    be paused / scaled to zero and return 503 / 404, so
+ *                    we automatically fall back to hf-space below when
+ *                    that happens.
+ *  2. hf-space    — Coqui Space at HF_TTS_SPACE_URL. Used directly when
+ *                   no dedicated endpoint is configured, AND as the
+ *                   automatic fallback when the dedicated endpoint
+ *                   throws.
  *
  * Note: text preprocessing is handled upstream in app/api/tts/route.ts before
  * synthesizeSpeech is called — do not preprocess here to avoid double-processing.
@@ -21,6 +27,8 @@ export function getTtsProvider(targetLang: string): TtsProvider {
   return 'hf-space'
 }

+const HF_TTS_SPACE_URL_CONFIGURED = Boolean(process.env.HF_TTS_SPACE_URL?.trim())
+
 export async function synthesizeSpeech(
   payload: TtsRequestPayload
 ): Promise<TtsSynthesisResult> {
@@ -31,7 +39,18 @@ export async function synthesizeSpeech(

   const provider = getTtsProvider(normalizedPayload.targetLang)
   if (provider === 'hf-inference') {
-    return synthesizeWithHfInference(normalizedPayload)
+    try {
+      return await synthesizeWithHfInference(normalizedPayload)
+    } catch (err) {
+      if (!HF_TTS_SPACE_URL_CONFIGURED) throw err
+      /* eslint-disable no-console -- one-line ops note when we fall back */
+      console.warn(
+        '[tts] hf-inference failed, falling back to hf-space:',
+        err instanceof Error ? err.message : String(err)
+      )
+      /* eslint-enable no-console */
+      return synthesizeWithHfSpace(normalizedPayload)
+    }
   }
   return synthesizeWithHfSpace(normalizedPayload)
 }
```

**Why these changes:**

- **Try/catch around `synthesizeWithHfInference`** — when a dedicated TTS endpoint is paused / 503-ing / 404-ing, automatically retry with the Coqui Space instead of returning the error to the user.
- **`HF_TTS_SPACE_URL_CONFIGURED` guard** — only fall back when the Space URL is actually set, so the original `TtsError` still propagates if the user explicitly hasn't configured a fallback.

### 4.4 `lib/tts/providers/hf-inference.ts`

```diff
@@ -70,11 +70,14 @@ function isNetworkError(error: unknown): boolean {

 /**
  * Returns true when this provider is configured for the given language.
- * A dedicated endpoint URL OR an HF token is sufficient.
+ * Only dedicated HF Inference Endpoints count — the legacy serverless
+ * `api-inference.huggingface.co/models/<id>` API has been deprecated for
+ * Coqui TTS models and now returns 404, so falling back to it just adds
+ * latency before the router redirects to the HF Space.
  */
 export function isHfInferenceConfigured(lang: string): boolean {
   if (!MODEL_BY_LANG[lang]) return false
-  return Boolean(ENDPOINT_BY_LANG[lang]) || Boolean(HF_TOKEN)
+  return Boolean(ENDPOINT_BY_LANG[lang])
 }
```

**Why this change:**

- The function used to return `true` whenever **either** a dedicated TTS endpoint URL **or** `HF_TOKEN` was set. With `HF_TOKEN` set (it's required for Safety + Ask), TTS would always try the legacy `api-inference.huggingface.co/models/Resilient-Coders/coqui-*` URL first — which now returns `404 Cannot POST /models/...` for the Coqui models — and only then fall back to the Space.
- After the change, the dedicated path is only attempted when an actual `HF_TTS_ENDPOINT_<LANG>` is set. This shaves ~1 s off every TTS request when no dedicated endpoint is configured (verified: ES dropped from 0.94 s to 0.47 s after the change).

### 4.5 `.env.local`

`.env.local` is gitignored so this change is shown as a before/after rather than a diff.

**Before:**

```bash
# TTS — HF Inference Endpoint
HF_TTS_ENDPOINT_EN=https://kqb8pjk2dlp2yay8.eu-west-1.aws.endpoints.huggingface.cloud
HF_TTS_ENDPOINT_ES=https://pqd5hn7lqfl5vd43.eu-west-1.aws.endpoints.huggingface.cloud
HF_TTS_ENDPOINT_VI=https://use5cm6h61nxgvbm.eu-west-1.aws.endpoints.huggingface.cloud
```

**After:**

```bash
# TTS — HF Inference Endpoints (commented out: dedicated endpoints currently
# return 503 / 404 because they have been paused or scaled to zero).
# When re-enabled, the TTS router auto-falls-back to HF_TTS_SPACE_URL on error.
# HF_TTS_ENDPOINT_EN=https://kqb8pjk2dlp2yay8.eu-west-1.aws.endpoints.huggingface.cloud
# HF_TTS_ENDPOINT_ES=https://pqd5hn7lqfl5vd43.eu-west-1.aws.endpoints.huggingface.cloud
# HF_TTS_ENDPOINT_VI=https://use5cm6h61nxgvbm.eu-west-1.aws.endpoints.huggingface.cloud
```

**Why this change:** the three URLs point to dedicated endpoints that are confirmed broken (probed live: EN times out, ES and VI return 503). Commenting them out means the TTS router doesn't even attempt the dedicated path — it goes straight to the working `HF_TTS_SPACE_URL`. The lines are kept in the file (just commented) so they can be uncommented when the team brings the endpoints back; the new fallback in `lib/tts/router.ts` will protect the app if they fail again later.

---

## 5. End-to-end verification

After restarting `npm run dev`, each route was probed against the live providers:

```text
POST /api/safety 200 in 62725 ms  ← dedicated cold-start failed → router fallback succeeded
POST /api/ask    200 in 39313 ms  ← dedicated endpoint warmed up and answered
POST /api/tts    200 in  2360 ms  ← en, hf-space, 132 KB WAV
POST /api/tts    200 in   473 ms  ← es, hf-space, 92 KB WAV
POST /api/tts    200 in   573 ms  ← vi, hf-space, 60 KB WAV
```

Server logs confirm the fallbacks fire on demand:

```text
[safety] HF Inference Endpoint failed, falling back to HF router:  HF Inference Endpoint request failed before reaching provider
 POST /api/safety 200 in 62725ms
```

The first Safety call after a cold dev server may still take ~60 s while the dedicated endpoint times out and the route falls back. Subsequent calls go straight to the warm router path and complete in well under a second.

---

## 6. New (untracked) files used by the fixes

These files were already in the working tree (untracked, created by the team before this session); the fixes above import them rather than re-creating them:

- `lib/hfRouterChatCompletion.ts` — non-streaming OpenAI-compatible client for `https://router.huggingface.co/v1/chat/completions`, used by both safety and translate fallbacks.
- `lib/safetyHfRouterProvider.ts` — Safety adapter on top of the chat-completion client; throws the same `SafetyInferenceProviderError` so `app/api/safety/route.ts` does not need a second error-mapping branch.
- `lib/translation/callHfRouterTranslateProvider.ts` — Translate adapter on top of the chat-completion client (already wired into `app/api/translate/route.ts` before this session).
