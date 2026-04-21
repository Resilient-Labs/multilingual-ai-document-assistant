import { RunTree } from "langsmith";

/**
 * Winnie / eval ticket: export one LangSmith run per completed Ask turn when tracing env is on.
 * Default: **no** full question or document text (only lengths + hashes + model metadata).
 * Set `ASK_LANGSMITH_RECORD_IO=true` on **staging only** when building a labeled eval set.
 */
export function isAskLangSmithExportEnabled(): boolean {
  const hasKey =
    process.env.LANGSMITH_API_KEY?.trim() ||
    process.env.LANGCHAIN_API_KEY?.trim();
  const tracingOn =
    process.env.LANGSMITH_TRACING === "true" ||
    process.env.LANGCHAIN_TRACING_V2 === "true";
  return Boolean(hasKey && tracingOn);
}

export type AskLangSmithFinishPayload = {
  questionHash: string | null;
  questionLen: number;
  chunkCount: number;
  answerLanguage: string;
  contextTextLen: number;
  modelId: string;
  finishReason: string | undefined;
  totalUsage: unknown;
  answerText: string;
  confidenceBandsVersion: string;
};

export async function postAskTurnToLangSmith(
  payload: AskLangSmithFinishPayload,
): Promise<void> {
  if (!isAskLangSmithExportEnabled()) {
    return;
  }

  const recordIo = process.env.ASK_LANGSMITH_RECORD_IO === "true";

  const inputs: Record<string, unknown> = {
    questionLen: payload.questionLen,
    questionHash: payload.questionHash ?? "",
    chunkCount: payload.chunkCount,
    answerLanguage: payload.answerLanguage,
    contextChars: payload.contextTextLen,
    modelId: payload.modelId,
    confidenceBandsVersion: payload.confidenceBandsVersion,
  };

  if (recordIo) {
    inputs._staging_eval_only =
      "ASK_LANGSMITH_RECORD_IO=true — may contain PII; do not use in production logging.";
  }

  const outputs: Record<string, unknown> = {
    finishReason: payload.finishReason ?? "",
    usage: payload.totalUsage ?? null,
    answerChars: payload.answerText.length,
  };

  if (recordIo) {
    outputs.answerText = payload.answerText;
  }

  const run = new RunTree({
    name: "ask-document-qa",
    run_type: "chain",
    inputs,
    tracingEnabled: true,
  });

  await run.end(outputs);
  await run.postRun();
}
