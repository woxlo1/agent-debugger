import {
  createUsage,
  type AiUsage,
  type AiSourceKind,
  type ConsentState,
  type CostSource,
  type RedactionReceipt,
  type UsageBuckets,
  type UsageConfidence,
} from "../../../shared/src/index.js"

export type AdapterContext = {
  id?: string
  traceId?: string
  eventId?: string
  observedAt?: number
  durationMs?: number
  consent?: ConsentState
  redaction?: RedactionReceipt
  cost?: number
  costSource?: CostSource
  warnings?: string[]
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return undefined
}

export function sumDefined(values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined)
  return defined.length > 0 ? defined.reduce((sum, value) => sum + value, 0) : undefined
}

export function makeId(prefix: string, supplied?: string): string {
  return supplied ?? `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildUsage(input: {
  prefix: string
  source: AiSourceKind
  confidence: UsageConfidence
  context: AdapterContext
  provider?: string
  model?: string
  responseModel?: string
  requestId?: string
  buckets: UsageBuckets
  warnings?: string[]
}): AiUsage {
  return createUsage({
    id: makeId(input.prefix, input.context.id),
    source: input.source,
    confidence: input.confidence,
    traceId: input.context.traceId,
    eventId: input.context.eventId,
    provider: input.provider,
    model: input.model,
    responseModel: input.responseModel,
    requestId: input.requestId,
    observedAt: input.context.observedAt,
    durationMs: input.context.durationMs,
    cost: input.context.cost,
    costSource: input.context.costSource,
    consent: input.context.consent ?? "not-required",
    redaction: input.context.redaction,
    warnings: [...(input.context.warnings ?? []), ...(input.warnings ?? [])],
    buckets: input.buckets,
  })
}
