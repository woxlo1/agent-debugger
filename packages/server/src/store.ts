import fs from "node:fs"
import path from "node:path"
import type { AgentEvent, TraceSummary } from "./schema.js"

const STORE_PATH =
  process.env.AGENT_DEBUGGER_STORE ??
  path.join(process.cwd(), ".agent-debugger", "events.ndjson")

/** Local, file-backed event store. No external service, no new dependency. */
class EventStore {
  private events: AgentEvent[] = []
  private ids = new Set<string>()
  private listeners = new Set<(event: AgentEvent) => void>()

  constructor() {
    this.load()
  }

  private load() {
    if (!fs.existsSync(STORE_PATH)) return
    const content = fs.readFileSync(STORE_PATH, "utf8")
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event = JSON.parse(trimmed) as AgentEvent
        if (!event.id || this.ids.has(event.id)) continue
        this.events.push(event)
        this.ids.add(event.id)
      } catch {
        // Skip corrupt persisted lines instead of failing startup.
      }
    }
  }

  private persist() {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
    const body = this.events.map((event) => JSON.stringify(event)).join("\n")
    fs.writeFileSync(STORE_PATH, body ? `${body}\n` : "")
  }

  add(event: AgentEvent) {
    if (this.ids.has(event.id)) return
    this.ids.add(event.id)
    this.events.push(event)
    this.persist()
    for (const listener of this.listeners) listener(event)
  }

  addMany(events: AgentEvent[]) {
    const addedIds = new Set<string>()
    for (const event of events) {
      if (this.ids.has(event.id)) continue
      this.ids.add(event.id)
      addedIds.add(event.id)
      this.events.push(event)
    }
    if (addedIds.size > 0) this.persist()
    for (const event of events) {
      if (!addedIds.has(event.id)) continue
      for (const listener of this.listeners) listener(event)
    }
    return addedIds.size
  }

  list(traceId?: string): AgentEvent[] {
    const copy = [...this.events]
    return traceId ? copy.filter((event) => event.traceId === traceId) : copy
  }

  traces(): TraceSummary[] {
    const map = new Map<string, TraceSummary>()
    for (const event of this.events) {
      const existing = map.get(event.traceId)
      if (!existing) {
        map.set(event.traceId, {
          traceId: event.traceId,
          eventCount: 1,
          startedAt: event.timestamp,
          updatedAt: event.timestamp,
        })
      } else {
        existing.eventCount += 1
        existing.updatedAt = Math.max(existing.updatedAt, event.timestamp)
        existing.startedAt = Math.min(existing.startedAt, event.timestamp)
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
    this.ids.clear()
    this.persist()
  }
}

export const store = new EventStore()
export { STORE_PATH }
