import type { AgentEvent, TraceSummary } from "./types"

// All requests go through the Vite dev proxy (/api -> http://localhost:4317)
export async function fetchTraces(): Promise<TraceSummary[]> {
  const res = await fetch("/api/traces")
  return res.json()
}

export async function fetchEvents(traceId: string): Promise<AgentEvent[]> {
  const res = await fetch(`/api/events?traceId=${encodeURIComponent(traceId)}`)
  return res.json()
}

export function subscribeToStream(onEvent: (event: AgentEvent) => void) {
  const source = new EventSource("/api/stream")
  source.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data))
    } catch {
      // ignore malformed messages
    }
  }
  return () => source.close()
}
