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
