import {
  createUsage,
  SOURCE_LABELS,
  type AiSourceKind,
  type AiUsage,
  type ConsentState,
  type CostSource,
  type RedactionReceipt,
  type UsageBuckets,
} from "../../shared/src/index.js"
import {
  normalizeAnthropicUsage,
  normalizeClaudeCodeUsage,
  normalizeClaudeWebExport,
  normalizeLangChainUsage,
  normalizeOpenAIUsage,
  normalizeOpenInferenceUsage,
  normalizeOtelGenAiUsage,
  normalizeSdkUsage,
  type AdapterContext,
} from "../../ingest/src/adapters/index.js"

export type NormalizeUsageInput = AdapterContext & {
  source: string
  payload: unknown
}

const BUCKET_KEYS: Array<keyof UsageBuckets> = [
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "reasoningTokens",
  "audioTokens",
  "totalTokens",
]

const CONSENT_REQUIRED_SOURCES = new Set<AiSourceKind>([
  "claude_code_local",
  "claude_web_export",
])

function isKnownSource(value: string): value is AiSourceKind {
  return Object.prototype.hasOwnProperty.call(SOURCE_LABELS, value)
}

function contextOf(input: NormalizeUsageInput): AdapterContext {
  return {
    id: input.id,
    traceId: input.traceId,
    eventId: input.eventId,
    observedAt: input.observedAt,
    durationMs: input.durationMs,
    consent: input.consent,
    redaction: input.redaction,
    cost: input.cost,
    costSource: input.costSource,
    warnings: input.warnings,
  }
}

/** Dispatch a caller-supplied payload to the matching source adapter. */
export function normalizeUsagePayload(input: NormalizeUsageInput): AiUsage | null {
  const context = contextOf(input)
  switch (input.source) {
    case "anthropic_api":
      return normalizeAnthropicUsage(input.payload, context)
    case "openai_api":
      return normalizeOpenAIUsage(input.payload, context)
    case "otel_genai":
      return normalizeOtelGenAiUsage(input.payload, context)
    case "openinference":
      return normalizeOpenInferenceUsage(input.payload, context)
    case "langchain_callback":
      return normalizeLangChainUsage(input.payload, context)
    case "sdk_explicit":
      return normalizeSdkUsage(input.payload, context)
    case "manual_import": {
      const usage = normalizeSdkUsage(input.payload, context)
      return usage
        ? { ...usage, source: "manual_import", sourceLabel: SOURCE_LABELS.manual_import }
        : null
    }
    case "claude_code_local":
      return normalizeClaudeCodeUsage(input.payload, context)
    case "claude_web_export":
      return normalizeClaudeWebExport(input.payload, context)
    default:
      return null
  }
}

/** Rebuild an entry from an allowlist so no extra raw field is persisted. */
export function sanitizeUsageEntry(value: unknown): AiUsage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (
    typeof raw.id !== "string" ||
    typeof raw.source !== "string" ||
    !isKnownSource(raw.source) ||
    (raw.confidence !== "reported" && raw.confidence !== "estimated" && raw.confidence !== "unknown")
  ) {
    return null
  }

  const buckets: UsageBuckets = {}
  for (const key of BUCKET_KEYS) {
    const bucketValue = raw[key]
    if (typeof bucketValue === "number" && Number.isFinite(bucketValue) && bucketValue >= 0) {
      buckets[key] = bucketValue
    }
  }

  const suppliedConsent: ConsentState =
    raw.consent === "granted" ||
    raw.consent === "denied" ||
    raw.consent === "required" ||
    raw.consent === "not-required"
      ? raw.consent
      : "not-required"
  const consent: ConsentState =
    CONSENT_REQUIRED_SOURCES.has(raw.source) && suppliedConsent === "not-required"
      ? "required"
      : suppliedConsent

  const costSource: CostSource =
    raw.costSource === "reported" || raw.costSource === "user-rate" ? raw.costSource : "none"

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((item): item is string => typeof item === "string")
    : []

  const redaction = isRedactionReceipt(raw.redaction) ? raw.redaction : undefined

  return createUsage({
    id: raw.id,
    source: raw.source as AiSourceKind,
    confidence: raw.confidence,
    traceId: typeof raw.traceId === "string" ? raw.traceId : undefined,
    eventId: typeof raw.eventId === "string" ? raw.eventId : undefined,
    provider: typeof raw.provider === "string" ? raw.provider : undefined,
    model: typeof raw.model === "string" ? raw.model : undefined,
    responseModel: typeof raw.responseModel === "string" ? raw.responseModel : undefined,
    requestId: typeof raw.requestId === "string" ? raw.requestId : undefined,
    observedAt: typeof raw.observedAt === "number" ? raw.observedAt : undefined,
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : undefined,
    cost: typeof raw.cost === "number" ? raw.cost : undefined,
    costSource,
    consent,
    redaction,
    warnings,
    buckets,
  })
}

function isRedactionReceipt(value: unknown): value is RedactionReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const receipt = value as Record<string, unknown>
  return (
    (receipt.profile === "strict" || receipt.profile === "balanced") &&
    receipt.rawValuesStored === false &&
    Array.isArray(receipt.findings) &&
    Array.isArray(receipt.skippedFields)
  )
}

export type PrivacyAudit = {
  entries: number
  rawValuesStored: false
  consent: Record<ConsentState, number>
  confidence: Record<"reported" | "estimated" | "unknown", number>
  redactionReceipts: number
  findings: Array<{ detector: string; count: number; needsReview: boolean }>
  skippedFields: number
  warnings: string[]
}

/** Aggregate redaction receipts and consent states without copying any raw value. */
export function auditPrivacy(entries: AiUsage[]): PrivacyAudit {
  const consent: Record<ConsentState, number> = {
    "not-required": 0,
    required: 0,
    granted: 0,
    denied: 0,
  }
  const confidence: Record<"reported" | "estimated" | "unknown", number> = {
    reported: 0,
    estimated: 0,
    unknown: 0,
  }
  const findings = new Map<string, { detector: string; count: number; needsReview: boolean }>()
  const warnings = new Set<string>()
  let redactionReceipts = 0
  let skippedFields = 0

  for (const entry of entries) {
    consent[entry.consent] += 1
    confidence[entry.confidence] += 1
    for (const warning of entry.warnings) warnings.add(warning)
    if (!entry.redaction) continue
    redactionReceipts += 1
    skippedFields += entry.redaction.skippedFields.length
    for (const finding of entry.redaction.findings) {
      const key = `${finding.detector}:${finding.needsReview ? "review" : "clean"}`
      const existing = findings.get(key)
      if (existing) {
        existing.count += finding.count
      } else {
        findings.set(key, {
          detector: finding.detector,
          count: finding.count,
          needsReview: finding.needsReview,
        })
      }
    }
  }

  if (entries.some((entry) => entry.consent === "required" || entry.consent === "denied")) {
    warnings.add("Some entries are excluded from totals until consent is granted")
  }

  return {
    entries: entries.length,
    rawValuesStored: false,
    consent,
    confidence,
    redactionReceipts,
    findings: [...findings.values()].sort((a, b) => a.detector.localeCompare(b.detector)),
    skippedFields,
    warnings: [...warnings],
  }
}
