import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/** Normalize an explicit SDK event that already carries usage values. */
export function normalizeSdkUsage(
  event: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const root = readRecord(event)
  if (!root) return null

  const usage = readRecord(root.usage)
  const inputTokens =
    readNumber(usage?.inputTokens ?? usage?.input_tokens ?? root.inputTokens)
  const outputTokens =
    readNumber(usage?.outputTokens ?? usage?.output_tokens ?? root.outputTokens)
  const cacheReadTokens = readNumber(
    usage?.cacheReadTokens ?? usage?.cache_read_tokens ?? root.cacheReadTokens,
  )
  const cacheWriteTokens = readNumber(
    usage?.cacheWriteTokens ?? usage?.cache_write_tokens ?? root.cacheWriteTokens,
  )

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    cacheReadTokens === undefined &&
    cacheWriteTokens === undefined
  ) {
    return null
  }

  return buildUsage({
    prefix: "sdk",
    source: "sdk_explicit",
    confidence: "reported",
    context,
    provider: readString(root.provider),
    model: readString(root.model),
    responseModel: readString(root.responseModel),
    requestId: readString(root.requestId),
    buckets: {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens:
        inputTokens === undefined &&
        outputTokens === undefined &&
        cacheReadTokens === undefined &&
        cacheWriteTokens === undefined
          ? undefined
          : [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].reduce<number>(
              (sum, value) => sum + (value ?? 0),
              0,
            ),
    },
  })
}
