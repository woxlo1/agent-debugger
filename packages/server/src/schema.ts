import crypto from "node:crypto"

/** Version of the event wire format understood by this build. */
export const SCHEMA_VERSION = 2

export type AgentEventType = "user" | "agent" | "tool" | "reasoning" | "system"
export type EventStatus = "ok" | "error" | "unknown"

export type SourceRef = {
  path?: string
  line?: number
  symbol?: string
}

export type EventError = {
  kind?: string
  message?: string
}

export type AgentEvent = {
  schemaVersion: number
  id: string
  traceId: string
  parentId?: string
  type: AgentEventType
  name: string
  status?: EventStatus
  error?: EventError
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

const SECRET_KEY =
  /(api[-_]?key|token|secret|password|passwd|authorization|auth|cookie|credential|private[-_]?key)/i
const SECRET_VALUE =
  /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/gi
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Recursively replace obvious secrets and personal identifiers. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (depth > 8) return "[REDACTED_DEPTH]"

  if (typeof value === "string") {
    return value.replace(SECRET_VALUE, "[REDACTED]").replace(EMAIL, "[REDACTED_EMAIL]")
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, depth + 1))
  }

  if (isRecord(value)) {
    // Build the output without computed property writes so imported keys such
    // as `__proto__` cannot mutate a prototype.
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : redact(entry, depth + 1),
      ]),
    )
  }

  return value
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function normalizeType(raw: Record<string, unknown>): AgentEventType {
  const direct = asString(raw.type)
  if (
    direct === "user" ||
    direct === "agent" ||
    direct === "tool" ||
    direct === "reasoning" ||
    direct === "system"
  ) {
    return direct
  }

  const attrs = isRecord(raw.attributes) ? raw.attributes : {}
  const kind = asString(attrs["openinference.span.kind"])?.toLowerCase() ?? ""
  const operation = asString(attrs["genai.operation.name"])?.toLowerCase() ?? ""
  if (kind.includes("tool") || operation.includes("tool")) return "tool"
  if (operation.includes("llm") || operation.includes("generation")) return "agent"

  return "agent"
}

function statusOf(raw: Record<string, unknown>): EventStatus {
  const status = asString(raw.status)?.toLowerCase()
  if (status === "error" || status === "failed" || raw.error !== undefined) return "error"
  if (status === "ok" || status === "success" || status === "successful") return "ok"

  const attrs = isRecord(raw.attributes) ? raw.attributes : {}
  const code = asNumber(attrs["status.code"])
  if (code === 2) return "error"
  if (code === 1) return "ok"

  return "unknown"
}

function errorOf(raw: Record<string, unknown>): EventError | undefined {
  const value = raw.error
  if (typeof value === "string" && value.trim()) return { message: value }
  if (isRecord(value)) {
    return {
      kind: asString(value.kind) ?? asString(value.type),
      message: asString(value.message) ?? asString(value.detail),
    }
  }

  const status = isRecord(raw.status) ? raw.status : undefined
  const message = status ? asString(status.message) : undefined
  if (message) return { message }

  return undefined
}

function sourceOf(raw: Record<string, unknown>): SourceRef | undefined {
  const direct = isRecord(raw.source) ? raw.source : undefined
  const attrs = isRecord(raw.attributes) ? raw.attributes : {}
  const path = asString(direct?.path) ?? asString(attrs["code.filepath"]) ?? asString(attrs["source.path"])
  const line =
    asNumber(direct?.line) ??
    asNumber(attrs["code.lineno"]) ??
    asNumber(attrs["source.line"])
  const symbol = asString(direct?.symbol) ?? asString(attrs["code.function"])
  if (!path && line === undefined && !symbol) return undefined
  return { path, line, symbol }
}

function durationOf(raw: Record<string, unknown>): number | undefined {
  const direct = asNumber(raw.durationMs)
  if (direct !== undefined) return direct

  const start = asNumber(raw.startTimeUnixNano) ?? asNumber(raw.start_time_unix_nano)
  const end = asNumber(raw.endTimeUnixNano) ?? asNumber(raw.end_time_unix_nano)
  if (start !== undefined && end !== undefined && end >= start) {
    return (end - start) / 1_000_000
  }

  const startMs = asNumber(raw.startTime) ?? asNumber(raw.startedAt)
  const endMs = asNumber(raw.endTime) ?? asNumber(raw.endedAt)
  if (startMs !== undefined && endMs !== undefined && endMs >= startMs) {
    return endMs - startMs
  }

  return undefined
}

/**
 * Normalize a raw event from any supported source into the versioned wire
 * format. Returns null when the record cannot be identified as an event.
 */
export function normalizeEvent(
  raw: unknown,
  fallbackTraceId: string,
): AgentEvent | null {
  if (!isRecord(raw)) return null

  const name = asString(raw.name)
  if (!name) return null

  const rawAttributes = isRecord(raw.attributes) ? redact(raw.attributes) : undefined
  const attributes = isRecord(rawAttributes)
    ? (rawAttributes as Record<string, unknown>)
    : undefined

  const error = errorOf(raw)
  const status = statusOf(raw)

  const event: AgentEvent = {
    schemaVersion: SCHEMA_VERSION,
    id: asString(raw.id) ?? crypto.randomUUID(),
    traceId: asString(raw.traceId) ?? fallbackTraceId,
    type: normalizeType(raw),
    name,
    timestamp:
      asNumber(raw.timestamp) ??
      asNumber(raw.startTime) ??
      asNumber(raw.start_time) ??
      Date.now(),
    status,
  }

  const parentId = asString(raw.parentId)
  if (parentId) event.parentId = parentId
  if (error) event.error = error

  const input = redact(raw.input)
  if (input !== undefined) event.input = input
  const output = redact(raw.output)
  if (output !== undefined) event.output = output

  const durationMs = durationOf(raw)
  if (durationMs !== undefined) event.durationMs = durationMs

  const tokens = asNumber(raw.tokens)
  if (tokens !== undefined) event.tokens = tokens
  const cost = asNumber(raw.cost)
  if (cost !== undefined) event.cost = cost

  const source = sourceOf(raw)
  if (source) event.source = source
  if (attributes) event.attributes = attributes

  return event
}
