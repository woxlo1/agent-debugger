import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/** Normalize a user-supplied claude.ai export record. No browser access or credentials are used. */
export function normalizeClaudeWebExport(
  record: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const root = readRecord(record)
  if (!root) return null

  const tokens = readRecord(root.usage ?? root.tokens)
  if (!tokens) return null

  const inputTokens =
    readNumber(tokens.input_tokens ?? tokens.input ?? tokens.prompt_tokens)
  const outputTokens =
    readNumber(tokens.output_tokens ?? tokens.output ?? tokens.completion_tokens)
  const cacheReadTokens = readNumber(tokens.cache_read_input_tokens ?? tokens.cached_tokens)

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    cacheReadTokens === undefined
  ) {
    return null
  }

  const consent = context.consent ?? "required"
  const warnings =
    consent === "granted"
      ? []
      : ["claude.ai Web export requires explicit consent before ingestion"]

  return buildUsage({
    prefix: "claude-web",
    source: "claude_web_export",
    confidence: "reported",
    context: { ...context, consent },
    provider: "anthropic",
    model: readString(root.model ?? root.model_name),
    requestId: readString(root.id ?? root.uuid),
    buckets: {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      totalTokens:
        inputTokens === undefined && outputTokens === undefined
          ? undefined
          : (inputTokens ?? 0) + (outputTokens ?? 0) + (cacheReadTokens ?? 0),
    },
    warnings,
  })
}
