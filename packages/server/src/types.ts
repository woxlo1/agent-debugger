// Shared event type. Kept duplicated (no shared package) to keep the MVP simple.
export type AgentEventType = "user" | "agent" | "tool" | "reasoning"

export type AgentEvent = {
  id: string
  traceId: string
  type: AgentEventType
  name: string
  input?: unknown
  output?: unknown
  timestamp: number
  tokens?: number
  cost?: number
}

export type TraceSummary = {
  traceId: string
  eventCount: number
  startedAt: number
  updatedAt: number
}
