import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/** Normalize OpenInference `llm.token_count.*` attributes. */
export function normalizeOpenInferenceUsage(
  attributes: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const attrs = readRecord(attributes)
  if (!attrs) return null

  const inputTokens = readNumber(attrs["llm.token_count.prompt"])
  const outputTokens = readNumber(attrs["llm.token_count.completion"])
  const reportedTotal = readNumber(attrs["llm.token_count.total"])
  const totalTokens =
    reportedTotal ??
    (inputTokens === undefined && outputTokens === undefined
      ? undefined
      : (inputTokens ?? 0) + (outputTokens ?? 0))

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return null
  }

  return buildUsage({
    prefix: "openinference",
    source: "openinference",
    confidence: "reported",
    context,
    provider: readString(attrs["llm.provider"]),
    model: readString(attrs["llm.model_name"]),
    responseModel: readString(attrs["llm.response.model_name"]),
    buckets: { inputTokens, outputTokens, totalTokens },
  })
}
