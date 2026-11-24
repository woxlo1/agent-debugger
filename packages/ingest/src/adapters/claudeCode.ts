import type { AiUsage } from "../../../shared/src/index.js"
import { buildUsage, readNumber, readRecord, readString, type AdapterContext } from "./common.js"

/**
 * Normalize a sanitized Claude Code transcript record. This function never
 * reads a transcript file. The caller must opt in, redact, and pass the record.
 */
export function normalizeClaudeCodeUsage(
  record: unknown,
  context: AdapterContext = {},
): AiUsage | null {
  const root = readRecord(record)
  if (!root) return null

  const message = readRecord(root.message)
  const usage = readRecord(root.usage ?? message?.usage)
  if (!usage) return null

  const inputTokens = readNumber(usage.input_tokens)
  const outputTokens = readNumber(usage.output_tokens)
  const cacheReadTokens = readNumber(usage.cache_read_input_tokens)
  const cacheWriteTokens = readNumber(usage.cache_creation_input_tokens)

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    cacheReadTokens === undefined &&
    cacheWriteTokens === undefined
  ) {
    return null
  }

  const consent = context.consent ?? "required"
  const warnings =
    consent === "granted"
      ? []
      : ["Claude Code transcript usage requires explicit consent before ingestion"]

  return buildUsage({
    prefix: "claude-code",
    source: "claude_code_local",
    confidence: "reported",
    context: { ...context, consent },
    provider: "anthropic",
    model: readString(root.model ?? message?.model),
    requestId: readString(root.uuid ?? root.id),
    buckets: {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens:
        [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].some(
          (value) => value !== undefined,
        )
          ? [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].reduce<number>(
              (sum, value) => sum + (value ?? 0),
              0,
            )
          : undefined,
    },
    warnings,
  })
}
