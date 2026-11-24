import crypto from "node:crypto"
import { isRecord, normalizeEvent, redact, type AgentEvent } from "./schema.js"

export type ImportFormat = "auto" | "ndjson" | "json"

export type ImportResult = {
  traceId: string
  events: AgentEvent[]
  imported: number
  skipped: number
}

function parseNdjson(text: string): unknown[] {
  const records: unknown[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      records.push(JSON.parse(trimmed))
    } catch {
      // Invalid lines are counted by the caller as skipped records.
      records.push({ __invalidJsonLine: true })
    }
  }
  return records
}

function parseJson(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text)
  if (Array.isArray(parsed)) return parsed
  if (isRecord(parsed) && Array.isArray(parsed.events)) return parsed.events
  if (isRecord(parsed) && Array.isArray(parsed.traces)) {
    return parsed.traces.flatMap((trace) =>
      isRecord(trace) && Array.isArray(trace.events) ? trace.events : [],
    )
  }
  return [parsed]
}

function detectFormat(text: string, requested: ImportFormat): "ndjson" | "json" {
  if (requested !== "auto") return requested
  const trimmed = text.trim()
  if (!trimmed) return "ndjson"
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      JSON.parse(trimmed)
      return "json"
    } catch {
      return "ndjson"
    }
  }
  return "ndjson"
}

/** Import NDJSON/JSON trace exports into the versioned event model. */
export function importTrace(input: {
  content?: string
  events?: unknown[]
  format?: ImportFormat
  traceId?: string
}): ImportResult {
  const traceId = input.traceId ?? `import-${crypto.randomUUID()}`
  let rawRecords: unknown[]

  if (Array.isArray(input.events)) {
    rawRecords = input.events
  } else if (typeof input.content === "string") {
    const format = detectFormat(input.content, input.format ?? "auto")
    rawRecords = format === "json" ? parseJson(input.content) : parseNdjson(input.content)
  } else {
    rawRecords = []
  }

  const events: AgentEvent[] = []
  let skipped = 0

  for (const record of rawRecords) {
    if (isRecord(record) && record.__invalidJsonLine === true) {
      skipped++
      continue
    }
    const event = normalizeEvent(record, traceId)
    if (!event) {
      skipped++
      continue
    }
    events.push(event)
  }

  events.sort((a, b) => a.timestamp - b.timestamp)

  const resolvedTraceId = input.traceId ?? events[0]?.traceId ?? traceId

  return {
    traceId: resolvedTraceId,
    events,
    imported: events.length,
    skipped,
  }
}

/** Produce a redacted NDJSON evidence bundle for one or more traces. */
export function exportNdjson(events: AgentEvent[]): string {
  return events
    .map((event) => JSON.stringify(redact(event)))
    .join("\n")
}
