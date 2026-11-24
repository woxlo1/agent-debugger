export type AgentEventType = "user" | "agent" | "tool" | "reasoning" | "system"
export type EventStatus = "ok" | "error" | "unknown"

export type SourceRef = {
  path?: string
  line?: number
  symbol?: string
}

export type AgentEvent = {
  schemaVersion: number
  id: string
  traceId: string
  parentId?: string
  type: AgentEventType
  name: string
  status?: EventStatus
  error?: { kind?: string; message?: string }
  input?: unknown
  output?: unknown
  timestamp: number
  durationMs?: number
  tokens?: number
  cost?: number
  source?: SourceRef
  attributes?: Record<string, unknown>
}

export type TraceSummary = {
  traceId: string
  eventCount: number
  startedAt: number
  updatedAt: number
}

export type Evidence = {
  id: string
  kind: string
  label: string
  detail: string
  eventIds: string[]
}

export type CauseCandidate = {
  id: string
  label: string
  confidence: "high" | "medium" | "low"
  evidenceIds: string[]
  falsifier: string
}

export type Analysis = {
  schemaVersion: number
  traceId: string
  generatedAt: number
  basedOn: string
  observed: Evidence[]
  candidates: CauseCandidate[]
  reproduction: { step: number; instruction: string; eventId?: string }[]
  handoff: { tool: string; command: string; note: string }[]
  unknowns: string[]
  metrics: {
    eventCount: number
    toolCalls: number
    errorEvents: number
  }
}

export type UsageConfidence = "reported" | "estimated" | "unknown"
export type ConsentState = "not-required" | "required" | "granted" | "denied"

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
  source: string
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
  costSource: "reported" | "user-rate" | "none"
  consent: ConsentState
  warnings: string[]
}

export type UsageLedger = {
  traceId: string
  entries: AiUsage[]
  totals: UsageBuckets & { cost?: number; entries: number }
  confidence: UsageConfidence
  warnings: string[]
  estimatedExcludedFromCost: boolean
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
