// agent-debugger-sdk
// Minimal client SDK: send a single event to the local agent-debugger server.
// Usage:
//   import { trace, setTraceId } from "agent-debugger-sdk"
//   setTraceId("my-run-1")
//   trace({ type: "tool", name: "search", input: "cats", output: "..." })

export type AgentEventType = "user" | "agent" | "tool" | "reasoning"

export type TraceInput = {
  type: AgentEventType
  name: string
  input?: unknown
  output?: unknown
  tokens?: number
  cost?: number
  traceId?: string
}

const DEFAULT_ENDPOINT =
  process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"

let currentTraceId =
  process.env.AGENT_DEBUGGER_TRACE_ID ?? `trace-${Date.now()}`

/** Set the traceId used for subsequent trace() calls that don't pass their own. */
export function setTraceId(traceId: string) {
  currentTraceId = traceId
}

export function getTraceId(): string {
  return currentTraceId
}

/**
 * Send one event to the agent-debugger server.
 * Fails silently (logs a warning) if the server isn't running, so it never
 * crashes the host agent process.
 */
export async function trace(event: TraceInput): Promise<void> {
  const payload = {
    id: crypto.randomUUID(),
    traceId: event.traceId ?? currentTraceId,
    type: event.type,
    name: event.name,
    input: event.input,
    output: event.output,
    tokens: event.tokens,
    cost: event.cost,
    timestamp: Date.now(),
  }

  try {
    await fetch(`${DEFAULT_ENDPOINT}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.warn(
      `[agent-debugger-sdk] could not reach server at ${DEFAULT_ENDPOINT}. Is "agent-debugger start" running?`,
      err instanceof Error ? err.message : err
    )
  }
}
