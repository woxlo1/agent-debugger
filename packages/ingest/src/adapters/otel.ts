import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/** Normalize OpenTelemetry GenAI span attributes into the shared usage contract. */
export function normalizeOtelGenAiUsage(
  attributes: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const attrs = readRecord(attributes)
  if (!attrs) return null

  const inputTokens =
    readNumber(attrs["gen_ai.usage.input_tokens"]) ??
    readNumber(attrs["gen_ai.usage.prompt_tokens"])
  const outputTokens =
    readNumber(attrs["gen_ai.usage.output_tokens"]) ??
    readNumber(attrs["gen_ai.usage.completion_tokens"])
  const cacheReadTokens =
    readNumber(attrs["gen_ai.usage.cache_read.input_tokens"]) ??
    readNumber(attrs["gen_ai.usage.cache_read_input_tokens"])
  const cacheWriteTokens =
    readNumber(attrs["gen_ai.usage.cache_creation.input_tokens"]) ??
    readNumber(attrs["gen_ai.usage.cache_creation_input_tokens"])

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    cacheReadTokens === undefined &&
    cacheWriteTokens === undefined
  ) {
    return null
  }

  const totalTokens =
    [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].some(
      (value) => value !== undefined,
    )
      ? [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].reduce<number>(
          (sum, value) => sum + (value ?? 0),
          0,
        )
      : undefined

  const provider = readString(attrs["gen_ai.provider.name"])
  const model = readString(attrs["gen_ai.request.model"])
  const responseModel = readString(attrs["gen_ai.response.model"])
  const requestId = readString(attrs["gen_ai.response.id"])

  return buildUsage({
    prefix: "otel",
    source: "otel_genai",
    confidence: "reported",
    context,
    provider,
    model,
    responseModel,
    requestId,
    buckets: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens },
  })
}
