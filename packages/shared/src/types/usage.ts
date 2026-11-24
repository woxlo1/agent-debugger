import type { RedactionReceipt } from "./privacy.js"
import type {
  AiSourceKind,
  ConsentState,
  CostSource,
  UsageConfidence,
} from "./source.js"
import { SOURCE_LABELS } from "./source.js"

/** Mutually exclusive token buckets. `inputTokens` excludes cached tokens. */
export type UsageBuckets = {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  audioTokens?: number
  totalTokens?: number
}

export type AiUsage = UsageBuckets & {
  id: string
  traceId?: string
  eventId?: string
  source: AiSourceKind
  sourceLabel: string
  confidence: UsageConfidence
  provider?: string
  model?: string
  responseModel?: string
  requestId?: string
  observedAt?: number
  durationMs?: number
  cost?: number
  currency: "USD"
  costSource: CostSource
  consent: ConsentState
  redaction?: RedactionReceipt
  warnings: string[]
}

export type UsageTotals = UsageBuckets & {
  cost?: number
  entries: number
}

export type UsageLedger = {
  traceId: string
  entries: AiUsage[]
  totals: UsageTotals
  confidence: UsageConfidence
  warnings: string[]
  estimatedExcludedFromCost: boolean
}

export function createUsage(input: {
  id: string
  source: AiSourceKind
  confidence: UsageConfidence
  traceId?: string
  eventId?: string
  provider?: string
  model?: string
  responseModel?: string
  requestId?: string
  observedAt?: number
  durationMs?: number
  cost?: number
  costSource?: CostSource
  consent?: ConsentState
  redaction?: RedactionReceipt
  warnings?: string[]
  buckets?: UsageBuckets
}): AiUsage {
  return {
    id: input.id,
    traceId: input.traceId,
    eventId: input.eventId,
    source: input.source,
    sourceLabel: SOURCE_LABELS[input.source],
    confidence: input.confidence,
    provider: input.provider,
    model: input.model,
    responseModel: input.responseModel,
    requestId: input.requestId,
    observedAt: input.observedAt,
    durationMs: input.durationMs,
    cost: input.cost,
    currency: "USD",
    costSource: input.costSource ?? "none",
    consent: input.consent ?? "not-required",
    redaction: input.redaction,
    warnings: input.warnings ?? [],
    ...input.buckets,
  }
}
