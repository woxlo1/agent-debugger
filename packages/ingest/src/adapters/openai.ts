import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/** Normalize an OpenAI-style response usage object into exclusive token buckets. */
export function normalizeOpenAIUsage(
  response: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const root = readRecord(response)
  const usage = readRecord(root?.usage)
  if (!root || !usage) return null

  const promptTokens = readNumber(usage.prompt_tokens ?? usage.input_tokens)
  const completionTokens = readNumber(usage.completion_tokens ?? usage.output_tokens)
  const promptDetails = readRecord(usage.prompt_tokens_details)
  const completionDetails = readRecord(usage.completion_tokens_details)

  const cacheReadTokens = readNumber(promptDetails?.cached_tokens)
  const reasoningTokens = readNumber(completionDetails?.reasoning_tokens)
  const audioInputTokens = readNumber(promptDetails?.audio_tokens)
  const audioOutputTokens = readNumber(completionDetails?.audio_tokens)
  const audioTokens =
    audioInputTokens === undefined && audioOutputTokens === undefined
      ? undefined
      : (audioInputTokens ?? 0) + (audioOutputTokens ?? 0)

  const warnings: string[] = []
  const inputTokens =
    promptTokens === undefined
      ? undefined
      : cacheReadTokens === undefined
        ? promptTokens
        : Math.max(0, promptTokens - cacheReadTokens)
  const outputTokens =
    completionTokens === undefined
      ? undefined
      : reasoningTokens === undefined
        ? completionTokens
        : Math.max(0, completionTokens - reasoningTokens)

  if (cacheReadTokens !== undefined && promptTokens !== undefined && cacheReadTokens > promptTokens) {
    warnings.push("cached_tokens exceeds prompt_tokens; input bucket clamped to zero")
  }

  const reportedTotal = readNumber(usage.total_tokens)
  const totalTokens =
    reportedTotal ??
    (inputTokens === undefined && outputTokens === undefined
      ? undefined
      : [inputTokens, outputTokens, cacheReadTokens, reasoningTokens, audioTokens].reduce<number>(
          (sum, value) => sum + (value ?? 0),
          0,
        ))

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    cacheReadTokens === undefined &&
    reportedTotal === undefined
  ) {
    return null
  }

  return buildUsage({
    prefix: "openai",
    source: "openai_api",
    confidence: "reported",
    context,
    provider: "openai",
    model: readString(root.model),
    responseModel: readString(root.model) ?? readString(root.model_slug),
    requestId: readString(root.id ?? usage.request_id),
    buckets: {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      reasoningTokens,
      audioTokens,
      totalTokens,
    },
    warnings,
  })
}
