import { RunTree } from "langsmith";

/**
 * Shared evaluation export (Team evaluation layer).
 * Uses the same LangSmith {@link RunTree} flow as `lib/langsmithAskRun.ts` — not a separate backend.
 *
 * - Gated by `EVALUATIONS_ENABLED=true` (any other value → no-op).
 * - Fire-and-forget from callers: `evaluateAsync` never throws and is not awaited.
 * - When enabled but LangSmith env is missing: one console warning, then return.
 *
 * Full `input` / `output` text is only attached when `ASK_LANGSMITH_RECORD_IO=true`
 * (same staging-only convention as Ask LangSmith runs).
 */

export type EvaluateAsyncParams = {
  input: string;
  output: string;
  model: string;
  feature: "ask" | "summarize" | "safety" | "translate" | "tts";
  metadata?: Record<string, unknown>;
};

function isEvaluationsEnabled(): boolean {
  return process.env.EVALUATIONS_ENABLED?.trim() === "true";
}

/** Same key + tracing rules as `isAskLangSmithExportEnabled` in `langsmithAskRun.ts`. */
function isLangSmithConfigured(): boolean {
  const hasKey =
    process.env.LANGSMITH_API_KEY?.trim() ||
    process.env.LANGCHAIN_API_KEY?.trim();
  const tracingOn =
    process.env.LANGSMITH_TRACING === "true" ||
    process.env.LANGCHAIN_TRACING_V2 === "true";
  return Boolean(hasKey && tracingOn);
}

async function postEvalRunToLangSmith(
  params: EvaluateAsyncParams,
): Promise<void> {
  const recordIo = process.env.ASK_LANGSMITH_RECORD_IO === "true";

  const inputs: Record<string, unknown> = {
    feature: params.feature,
    modelId: params.model,
    inputChars: params.input.length,
    outputChars: params.output.length,
    ...(params.metadata ?? {}),
  };

  if (recordIo) {
    inputs._staging_eval_only =
      "ASK_LANGSMITH_RECORD_IO=true — may contain PII; do not use in production logging.";
    inputs.input = params.input;
  }

  const outputs: Record<string, unknown> = {
    outputChars: params.output.length,
  };

  if (recordIo) {
    outputs.output = params.output;
  }

  const run = new RunTree({
    name: `evaluation-${params.feature}`,
    run_type: "chain",
    inputs,
    tracingEnabled: true,
  });

  await run.end(outputs);
  await run.postRun();
}

export function evaluateAsync(params: EvaluateAsyncParams): void {
  if (!isEvaluationsEnabled()) {
    return;
  }

  if (!isLangSmithConfigured()) {
    /* eslint-disable no-console -- intentional operator warning */
    console.warn(
      "[evaluate] EVALUATIONS_ENABLED is true but LangSmith is not configured. Set LANGSMITH_API_KEY (or LANGCHAIN_API_KEY) and LANGSMITH_TRACING=true (or LANGCHAIN_TRACING_V2=true). Skipping export.",
    );
    /* eslint-enable no-console */
    return;
  }

  void postEvalRunToLangSmith(params).catch((err: unknown) => {
    /* eslint-disable no-console */
    console.error(
      "[evaluate] LangSmith export error:",
      err instanceof Error ? err.message : String(err),
    );
    /* eslint-enable no-console */
  });
}
