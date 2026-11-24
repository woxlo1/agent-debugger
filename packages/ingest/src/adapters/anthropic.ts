import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/** Normalize an Anthropic Messages response. The caller already has the response; this adapter never calls Anthropic. */
export function normalizeAnthropicUsage(
  response: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const root = readRecord(response)
  const usage = readRecord(root?.usage)
  if (!root || !usage) return null

  const inputTokens = readNumber(usage.input_tokens)
  const outputTokens = readNumber(usage.output_tokens)
  const cacheReadTokens = readNumber(usage.cache_read_input_tokens)
  const cacheCreation =
    readRecord(usage.cache_creation)?.input_tokens ?? usage.cache_creation_input_tokens
  const cacheWriteTokens = readNumber(cacheCreation)

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    cacheReadTokens === undefined &&
    cacheWriteTokens === undefined
  ) {
    return null
  }

  const totalTokens =
    readNumber(usage.total_tokens) ??
    (([inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].some(
      (value) => value !== undefined,
    )
      ? [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].reduce<number>(
          (sum, value) => sum + (value ?? 0),
          0,
        )
      : undefined))

  return buildUsage({
    prefix: "anthropic",
    source: "anthropic_api",
    confidence: "reported",
    context,
    provider: "anthropic",
    model: readString(root.model),
    responseModel: readString(readRecord(root.model_details)?.id ?? readRecord(root.model)?.id),
    requestId: readString(root.id),
    buckets: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens },
  })
}
