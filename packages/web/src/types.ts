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

export type CausePackageProvenance = {
  generator: string
  generatorVersion: string
  source: "local-store"
  eventSchemaVersion: number
  analysisEngine: string
}

export type CausePackage = {
  schemaVersion: number
  kind: "cause-package"
  packageId: string
  generatedAt: number
  traceId: string
  provenance: CausePackageProvenance
  analysis: Analysis
  usage: UsageLedger
  privacy: PrivacyAudit
  events: AgentEvent[]
  integrity: {
    eventCount: number
    redacted: boolean
    rawValuesStored: boolean
    sha256: string
  }
  fingerprint: string
}

export type NumericDiff = {
  key: string
  a: number
  b: number
  delta: number
  changed: boolean
}

export type StringSetDiff = {
  onlyA: string[]
  onlyB: string[]
  shared: string[]
}

export type EntityComparison<T> = {
  id: string
  state: "same" | "changed"
  changedFields: string[]
  a: T
  b: T
}

export type CaseSummary = {
  traceId: string
  packageId: string
  generatedAt: number
  fingerprint: string
  analysisEngine: string
  eventSchemaVersion: number
  confidence: UsageConfidence
  eventCount: number
}

export type CaseComparison = {
  schemaVersion: number
  kind: "case-comparison"
  a: CaseSummary
  b: CaseSummary
  metrics: NumericDiff[]
  evidence: {
    onlyA: Evidence[]
    onlyB: Evidence[]
    shared: Array<EntityComparison<Evidence>>
  }
  candidates: {
    onlyA: CauseCandidate[]
    onlyB: CauseCandidate[]
    shared: Array<EntityComparison<CauseCandidate>>
  }
  unknowns: StringSetDiff
  usage: {
    totals: NumericDiff[]
    confidence: {
      a: UsageConfidence
      b: UsageConfidence
      changed: boolean
    }
    estimatedExcludedFromCost: {
      a: boolean
      b: boolean
      changed: boolean
    }
    warnings: StringSetDiff
  }
  privacy: {
    rawValuesStored: false
    fields: NumericDiff[]
    consent: NumericDiff[]
    confidence: NumericDiff[]
    findings: NumericDiff[]
    warnings: StringSetDiff
  }
  notes: string[]
}
