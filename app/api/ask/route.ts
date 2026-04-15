import { createHash } from "crypto";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import {
  ASK_CONFIDENCE_BANDS_VERSION,
  ASK_CONFIDENCE_OVERLAP_HIGH,
  ASK_CONFIDENCE_OVERLAP_MEDIUM,
} from "@/lib/askConfidenceBands";

if (!process.env.TOGETHER_API_KEY?.trim()) {
  /* eslint-disable no-console -- one-time module load diagnostic */
  console.error(
    "[ask] startup check: TOGETHER_API_KEY is missing — POST /api/ask will return 503 until it is set in the environment.",
  );
  /* eslint-enable no-console */
}

/**
 * POST /api/ask — Team 1 Ask / Q&A (stateless).
 *
 * Flow (read this before changing anything):
 * 1. The browser loads the document into EntityDB and (optionally) embeds chunks client-side.
 * 2. AskTab calls `queryChunks()` in the browser, then POSTs here with `question` + `chunks[]`
 *    (or `context`). The server never reads IndexedDB — all document text arrives in the JSON body.
 * 3. We build a single `contextText` string, attach Team 1 research-shaped instructions, and
 *    stream tokens back via the Vercel AI SDK UI message stream (`toUIMessageStreamResponse`).
 * 4. AskTab must parse that stream with `parseJsonEventStream` + `readUIMessageStream` (see AskTab).
 *
 * Model hosting (Research Conclusions + Sprint 3 handoff): Together AI + **Meta Llama** (OpenAI-compatible).
 * `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` is **dedicated-only** on Together after 2026-03-06 (no serverless).
 * **Default:** `meta-llama/Meta-Llama-3-8B-Instruct-Lite` — Meta **Llama 3** 8B, serverless on Together (~8K context). Closest handoff “8B Llama” without a dedicated endpoint (Llama **3.1** 8B differs; see below).
 * Together’s serverless catalog footnotes this model as deprecated; monitor [deprecations](https://docs.together.ai/docs/deprecations) and set `TOGETHER_MODEL` when migrating.
 * **Llama 3.1 8B on Together:** use a [dedicated endpoint](https://docs.together.ai/docs/dedicated-endpoints), then `TOGETHER_MODEL` (+ optional `TOGETHER_BASE_URL`).
 * **Larger serverless Llama:** e.g. `meta-llama/Llama-3.3-70B-Instruct-Turbo` via `TOGETHER_MODEL`.
 * We use `@ai-sdk/openai` (`createOpenAI`) against Together’s base URL.
 */
const DEFAULT_TOGETHER_BASE_URL = "https://api.together.xyz/v1";
/** Meta Llama 3 8B Instruct Lite — Together serverless (see block comment). */
const DEFAULT_TOGETHER_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct-Lite";

// TODO [Karlee] — Baseline model & fine-tuning ticket: default `TOGETHER_MODEL` / base URL and OpenAI-compatible provider wiring
// Model quality not yet validated against eval set
// Fine-tuning decision pending Karlee's baseline eval results
// Do not treat current output quality as production-ready until Karlee's gate is passed

/** Niche line until PM locks domain — Team 1 research uses `[chosen domain]`. */
const ASK_DOMAIN_LINE =
  "government or legal document (benefits, notices, agreements).";

// TODO [Zaria] — Guardrails ticket: `ASK_DOMAIN_LINE` narrows assistant behavior to government / legal / benefits framing
// v1 draft — final behavior pending Zaria's prompt rules, schema validation,
// input cleaning, output checking, refusal behavior, and domain restriction spec

function getTogetherLanguageModel() {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey?.trim()) {
    return null;
  }
  const baseURL =
    process.env.TOGETHER_BASE_URL?.trim() || DEFAULT_TOGETHER_BASE_URL;
  const provider = createOpenAI({
    apiKey,
    baseURL,
  });
  const modelId =
    process.env.TOGETHER_MODEL?.trim() || DEFAULT_TOGETHER_MODEL;
  return provider.chat(modelId);
}

function buildSystemPrompt(
  contextText: string,
  answerLanguage: "es" | "en" | undefined,
): string {
  // TODO [Zaria] — Guardrails ticket: full system prompt text (rules, domain line, refusal tone, direct-answer wording)
  // v1 draft — final behavior pending Zaria's prompt rules, schema validation,
  // input cleaning, output checking, refusal behavior, and domain restriction spec
  // TODO [Karlee] — Baseline model & fine-tuning ticket: system prompt not yet validated for this baseline model
  // Model quality not yet validated against eval set
  // Fine-tuning decision pending Karlee's baseline eval results
  // Do not treat current output quality as production-ready until Karlee's gate is passed

  const hasContext = contextText.trim().length > 0;
  const contextBlock = hasContext
    ? contextText
    : "(No document context was sent with this request.)";

  const langName = answerLanguage === "es" ? "Spanish" : "English";
  const langLead =
    answerLanguage === "es" || answerLanguage === "en"
      ? `CRITICAL — Output language: Write your entire answer in ${langName}, including every sentence and list item. The document context may be in another language; translate ideas into ${langName} for the user. Do not write the main answer in English if the required language is Spanish.\n\n`
      : "";

  // Shape follows Team 1 Research Conclusions (System / Context / rules) — draft until Zaria guardrails ticket.
  return `${langLead}You are a helpful assistant. Answer the question using ONLY the provided context and ONLY within the ${ASK_DOMAIN_LINE} domain.

Context:
${contextBlock}

Rules (Team 1 research — draft guardrails):
1. Only answer from the context above. If the answer is not there, say clearly that you could not find it in the document.
2. Never give legal, medical, immigration, or financial advice — tell the user to consult a qualified professional.
3. Use plain language at roughly a 6th grade reading level (still in the required output language).
4. Never guess or invent facts.
5. If you quote or paraphrase the document, mention where in the context the idea appeared (e.g. first or second paragraph) if no page numbers exist.
6. **Language:** The client marked the question language as ${answerLanguage ?? "unspecified"}; still follow the CRITICAL output language above when set.
7. **Direct answer:** Start in plain language. Do NOT begin the answer with meta-phrases such as "According to the provided context", "Based on the provided context", "Based on the document", or similar wrappers — answer as if speaking to the user, without referencing that you were given context.

After your answer, the UI may show separate trust labels; do not fabricate numeric confidence scores.
8. **UI trust labels (alignment):** The Ask tab derives green/yellow/red trust colors on the **client** from lexical overlap between your answer and the retrieved context. Engineering constants for this build — \`lib/askConfidenceBands.ts\` version **${ASK_CONFIDENCE_BANDS_VERSION}**: raw overlap “high” if ≥ **${ASK_CONFIDENCE_OVERLAP_HIGH}**, “medium” if ≥ **${ASK_CONFIDENCE_OVERLAP_MEDIUM}**, plus substantive Spanish / paraphrase floors in that module. When your answer is faithful, reusing accurate wording from the document improves overlap; never invent facts to game overlap.`;
}

function hashForAskLog(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

/** Inline guard: refuse to emit log lines that accidentally include long strings (raw question / document). */
/** True when LangSmith / LangChain tracing keys are set (boolean only — never log secrets). */
function langsmithTracingEnvPresent(): boolean {
  return Boolean(
    process.env.LANGSMITH_API_KEY?.trim() ||
      process.env.LANGCHAIN_API_KEY?.trim(),
  );
}

function assertAskLogHasNoRawTextPayload(
  label: string,
  payload: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== "string") continue;
    if (value.length > 48) {
      const msg = `[ask] log guard (${label}): field "${key}" is too long (${value.length}) — refusing to treat as safe telemetry`;
      /* eslint-disable no-console */
      console.error(msg);
      /* eslint-enable no-console */
      if (process.env.NODE_ENV === "development") {
        throw new Error(msg);
      }
    }
  }
}

/**
 * POST /api/ask
 * Body: { question: string, context?: string, chunks?: string[], answerLanguage?: "es" | "en" }
 */
export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = await request.json();
    const question = body?.question as string | undefined;
    const context = body?.context as string | undefined;
    const chunks = body?.chunks as string[] | undefined;
    const rawLang = body?.answerLanguage as string | undefined;
    const answerLanguage =
      rawLang === "es" || rawLang === "en" ? rawLang : undefined;

    const questionLen = typeof question === "string" ? question.length : 0;
    const questionHash =
      typeof question === "string" && question
        ? hashForAskLog(question)
        : null;

    // TODO [Winnie] — Evaluation & calibration ticket: Ask route log fields and LangSmith / observability mapping
    // `langsmithTracingEnvPresent` is a bridge flag until traces are wired (Vercel AI SDK telemetry / LangSmith).
    // Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
    // Multilingual accuracy target: >85% per language — EN + ES only for V1
    /* eslint-disable no-console -- Ask route observability: never log raw question or document text */
    const requestLogPayload = {
      hasQuestion: Boolean(question?.trim()),
      questionLen,
      questionHash,
      chunkCount: Array.isArray(chunks) ? chunks.length : 0,
      hasContextField: typeof context === "string" && context.length > 0,
      answerLanguage: answerLanguage ?? "unset",
      confidenceBandsVersion: ASK_CONFIDENCE_BANDS_VERSION,
      confidenceOverlapHigh: ASK_CONFIDENCE_OVERLAP_HIGH,
      confidenceOverlapMedium: ASK_CONFIDENCE_OVERLAP_MEDIUM,
      langsmithTracingEnvPresent: langsmithTracingEnvPresent(),
    };
    assertAskLogHasNoRawTextPayload("request_received", requestLogPayload);
    console.log("[ask] request received", requestLogPayload);
    /* eslint-enable no-console */

    const model = getTogetherLanguageModel();
    if (!model) {
      const durationMs = Date.now() - started;
      /* eslint-disable no-console */
      console.error(
        "[ask] together ai error:",
        "Together API is not configured (missing TOGETHER_API_KEY)",
        "— latency:",
        durationMs,
        "ms",
      );
      /* eslint-enable no-console */
      return NextResponse.json(
        {
          error:
            "Together API is not configured. Set TOGETHER_API_KEY (see .env.local.example).",
        },
        { status: 503 },
      );
    }

    if (!question) {
      const durationMs = Date.now() - started;
      /* eslint-disable no-console */
      console.error(
        "[ask] together ai error:",
        "question required",
        "— latency:",
        durationMs,
        "ms",
      );
      /* eslint-enable no-console */
      return NextResponse.json(
        { error: "question required" },
        { status: 400 },
      );
    }

    // Client-side RAG: chunks are built in the browser (EntityDB); server only concatenates.
    // TODO [Brandi] — Data & inputs ticket: `contextText` is whatever chunks/context the client sent (boundaries, overlap, metadata opaque here)
    // Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
    const contextText = context ?? chunks?.join("\n\n") ?? "";
    const systemPrompt = buildSystemPrompt(contextText, answerLanguage);

    // TODO [Karlee] — Baseline model & fine-tuning ticket: `streamText` assumes this model follows system + user turns reliably
    // Model quality not yet validated against eval set
    // Fine-tuning decision pending Karlee's baseline eval results
    // Do not treat current output quality as production-ready until Karlee's gate is passed
    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    const durationMs = Date.now() - started;
    const successLogPayload = {
      questionHash,
      questionLen,
    };
    assertAskLogHasNoRawTextPayload("stream_ok", successLogPayload);
    /* eslint-disable no-console */
    console.log("[ask] together ai response ok — latency:", durationMs, "ms", successLogPayload);
    /* eslint-enable no-console */

    try {
      return result.toUIMessageStreamResponse();
    } catch (streamErr) {
      /* eslint-disable no-console */
      const streamMsg =
        streamErr instanceof Error ? streamErr.message : String(streamErr);
      const streamLatency = Date.now() - started;
      console.error(
        "[ask] together ai error:",
        `toUIMessageStreamResponse failed: ${streamMsg}`,
        "— latency:",
        streamLatency,
        "ms",
      );
      /* eslint-enable no-console */
      return NextResponse.json(
        { error: "Question answering failed" },
        { status: 500 },
      );
    }
  } catch (err) {
    /* eslint-disable no-console */
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - started;
    console.error(
      "[ask] together ai error:",
      message,
      "— latency:",
      durationMs,
      "ms",
    );
    /* eslint-enable no-console */
    return NextResponse.json(
      { error: "Question answering failed" },
      { status: 500 },
    );
  }
}
