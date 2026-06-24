import type { AgentEvent, TraceSummary } from "./types.js"

// Very small in-memory store. No persistence on purpose: this is a local
// debugging tool, restart = clean slate. Good enough for MVP.
class EventStore {
  private events: AgentEvent[] = []
  private listeners: Set<(event: AgentEvent) => void> = new Set()

  add(event: AgentEvent) {
    this.events.push(event)
    for (const listener of this.listeners) listener(event)
  }

  list(traceId?: string): AgentEvent[] {
    if (!traceId) return this.events
    return this.events.filter((e) => e.traceId === traceId)
  }

  traces(): TraceSummary[] {
    const map = new Map<string, TraceSummary>()
    for (const e of this.events) {
      const existing = map.get(e.traceId)
      if (!existing) {
        map.set(e.traceId, {
          traceId: e.traceId,
          eventCount: 1,
          startedAt: e.timestamp,
          updatedAt: e.timestamp,
        })
      } else {
        existing.eventCount += 1
        existing.updatedAt = Math.max(existing.updatedAt, e.timestamp)
        existing.startedAt = Math.min(existing.startedAt, e.timestamp)
      }
    }
    return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  clear() {
    this.events = []
  }
}

export const store = new EventStore()
