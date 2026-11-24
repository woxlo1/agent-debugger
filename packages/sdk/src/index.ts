// agent-debugger-sdk
// Minimal client for sending versioned agent events to the local debugger.
// Works with the TypeScript SDK or from any language via `agent-debugger pipe`.

import { randomUUID } from "node:crypto"

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

export type TraceInput = {
  type: AgentEventType
  name: string
  input?: unknown
  output?: unknown
  tokens?: number
  cost?: number
  traceId?: string
  parentId?: string
  status?: EventStatus
  error?: string | EventError
  source?: SourceRef
  durationMs?: number
  attributes?: Record<string, unknown>
}

export type AgentEvent = TraceInput & {
  schemaVersion: number
  id: string
  timestamp: number
}

export type TraceResult = {
  ok: boolean
  event?: AgentEvent
  error?: string
}

const SECRET_KEY =
  /(api[-_]?key|token|secret|password|passwd|authorization|auth|cookie|credential)/i
const SECRET_VALUE =
  /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+)/gi
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (depth > 8) return "[REDACTED_DEPTH]"
  if (typeof value === "string") {
    return value.replace(SECRET_VALUE, "[REDACTED]").replace(EMAIL, "[REDACTED_EMAIL]")
  }
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1))
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : redact(entry, depth + 1),
      ]),
    )
  }
  return value
}

function safeSource(source: SourceRef | undefined): SourceRef | undefined {
  if (!source) return undefined
  const redacted = redact(source) as SourceRef
  if (!redacted.path) return redacted
  const segments = redacted.path.replace(/\\/g, "/").split("/").filter(Boolean)
  return { ...redacted, path: segments.length > 2 ? segments.slice(-2).join("/") : redacted.path }
}

let endpoint = process.env.AGENT_DEBUGGER_URL ?? "http://127.0.0.1:4317"
let token = process.env.AGENT_DEBUGGER_TOKEN
let currentTraceId =
  process.env.AGENT_DEBUGGER_TRACE_ID ?? `trace-${Date.now()}`

export function setTraceId(traceId: string) {
  currentTraceId = traceId
}

export function getTraceId(): string {
  return currentTraceId
}

export function setEndpoint(url: string) {
  endpoint = url.replace(/\/$/, "")
}

export function setToken(value: string | undefined) {
  token = value
}

function normalizeError(error: TraceInput["error"]): EventError | undefined {
  if (!error) return undefined
  const normalized: EventError =
    typeof error === "string" ? { message: error } : { ...error }
  return redact(normalized) as EventError
}

async function send(event: TraceInput): Promise<TraceResult> {
  const payload: AgentEvent = {
    schemaVersion: SCHEMA_VERSION,
    id: randomUUID(),
    traceId: event.traceId ?? currentTraceId,
    type: event.type,
    name: redact(event.name) as string,
    input: redact(event.input),
    output: redact(event.output),
    tokens: event.tokens,
    cost: event.cost,
    parentId: event.parentId,
    status: event.status,
    error: normalizeError(event.error),
    source: safeSource(event.source),
    durationMs: event.durationMs,
    attributes: event.attributes
      ? (redact(event.attributes) as Record<string, unknown>)
      : undefined,
    timestamp: Date.now(),
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["x-agent-debugger-token"] = token

  try {
    const response = await fetch(`${endpoint}/api/events`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      return { ok: false, event: payload, error: `HTTP ${response.status}` }
    }
    return { ok: true, event: payload }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    console.warn(
      `[agent-debugger-sdk] could not reach ${endpoint}. Is the local server running? ${message}`,
    )
    return { ok: false, event: payload, error: message }
  }
}

/** Send one event. Never throws; inspect the returned result. */
export async function trace(event: TraceInput): Promise<TraceResult> {
  return send(event)
}

/** Send one event and throw when delivery fails. */
export async function traceOrThrow(event: TraceInput): Promise<AgentEvent> {
  const result = await send(event)
  if (!result.ok || !result.event) {
    throw new Error(result.error ?? "Failed to send agent event")
  }
  return result.event
}
