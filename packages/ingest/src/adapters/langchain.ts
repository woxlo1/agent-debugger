import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/** Normalize LangChain callback metadata when the provider usage is present. */
export function normalizeLangChainUsage(
  metadata: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const root = readRecord(metadata)
  if (!root) return null

  const usage =
    readRecord(root.usage_metadata) ??
    readRecord(root.token_usage) ??
    readRecord(root.llm_usage)
  if (!usage) return null

  const inputTokens =
    readNumber(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokenCount)
  const outputTokens =
    readNumber(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokenCount)
  const cacheReadTokens =
    readNumber(usage.cache_read_input_tokens ?? usage.cached_tokens)

  if (inputTokens === undefined && outputTokens === undefined && cacheReadTokens === undefined) {
    return null
  }

  const warnings: string[] = []
  if (cacheReadTokens !== undefined && inputTokens !== undefined && cacheReadTokens > inputTokens) {
    warnings.push("cache_read_input_tokens exceeds input_tokens; input bucket clamped to zero")
  }
  const exclusiveInputTokens =
    inputTokens === undefined
      ? undefined
      : Math.max(0, inputTokens - (cacheReadTokens ?? 0))
  const reportedTotal = readNumber(usage.total_tokens)
  const totalTokens =
    reportedTotal ??
    (exclusiveInputTokens === undefined && outputTokens === undefined
      ? undefined
      : (exclusiveInputTokens ?? 0) + (outputTokens ?? 0) + (cacheReadTokens ?? 0))

  return buildUsage({
    prefix: "langchain",
    source: "langchain_callback",
    confidence: "reported",
    context,
    provider: readString(root.ls_provider ?? root.provider),
    model: readString(root.model_name ?? root.model ?? usage.model_name),
    requestId: readString(root.ls_run_id ?? root.run_id),
    buckets: {
      inputTokens: exclusiveInputTokens,
      outputTokens,
      cacheReadTokens,
      totalTokens,
    },
    warnings,
  })
}
