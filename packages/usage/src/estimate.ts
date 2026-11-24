import { createUsage, SOURCE_LABELS, type AiUsage } from "../../shared/src/index.js"

/** Local-only heuristic. Never presented as provider-reported billing data. */
export function estimateTokensFromText(text: string, charsPerToken = 4): number {
  if (!text) return 0
  return Math.ceil(text.trim().length / Math.max(1, charsPerToken))
}

export function createEstimatedUsage(
  text: string,
  options: {
    id: string
    traceId?: string
    eventId?: string
    model?: string
    provider?: string
    charsPerToken?: number
  },
): AiUsage {
  return createUsage({
    id: options.id,
    source: "local_estimate",
    confidence: "estimated",
    traceId: options.traceId,
    eventId: options.eventId,
    provider: options.provider,
    model: options.model,
    costSource: "none",
    consent: "not-required",
    warnings: [
      `Local estimate using ${options.charsPerToken ?? 4} characters per token; excluded from billing totals by default`,
    ],
    buckets: { inputTokens: estimateTokensFromText(text, options.charsPerToken) },
  })
}

export const ESTIMATE_SOURCE_LABEL = SOURCE_LABELS.local_estimate
