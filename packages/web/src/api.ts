import type {
  AgentEvent,
  Analysis,
  CaseComparison,
  CausePackage,
  PrivacyAudit,
  TraceSummary,
  UsageLedger,
} from "./types"

// All requests go through the Vite dev proxy (/api -> http://localhost:4317)
export async function fetchTraces(): Promise<TraceSummary[]> {
  const res = await fetch("/api/traces")
  if (!res.ok) throw new Error(`Failed to load traces: HTTP ${res.status}`)
  return res.json()
}

export async function fetchEvents(traceId: string): Promise<AgentEvent[]> {
  const res = await fetch(`/api/events?traceId=${encodeURIComponent(traceId)}`)
  if (!res.ok) throw new Error(`Failed to load events: HTTP ${res.status}`)
  return res.json()
}

export async function fetchAnalysis(traceId: string): Promise<Analysis> {
  const res = await fetch(
    `/api/traces/${encodeURIComponent(traceId)}/analysis`,
  )
  if (!res.ok) throw new Error(`Failed to load analysis: HTTP ${res.status}`)
  return res.json()
}

export async function fetchUsage(
  traceId: string,
  includeEstimates = false,
): Promise<UsageLedger> {
  const query = includeEstimates ? "?includeEstimates=true" : ""
  const res = await fetch(
    `/api/traces/${encodeURIComponent(traceId)}/usage${query}`,
  )
  if (!res.ok) throw new Error(`Failed to load usage: HTTP ${res.status}`)
  return res.json()
}

export async function fetchPrivacy(traceId: string): Promise<PrivacyAudit> {
  const res = await fetch(
    `/api/traces/${encodeURIComponent(traceId)}/privacy`,
  )
  if (!res.ok) throw new Error(`Failed to load privacy audit: HTTP ${res.status}`)
  return res.json()
}

export async function importTrace(content: string): Promise<{
  traceId: string
  imported: number
  added: number
  skipped: number
}> {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, format: "auto" }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body
}

export function exportUrl(traceId: string): string {
  return `/api/traces/${encodeURIComponent(traceId)}/export`
}

export function packageUrl(
  traceId: string,
  includeEstimates = false,
): string {
  const query = includeEstimates ? "?includeEstimates=true" : ""
  return `/api/traces/${encodeURIComponent(traceId)}/package${query}`
}

export async function fetchCasePackage(
  traceId: string,
  includeEstimates = false,
): Promise<CausePackage> {
  const res = await fetch(packageUrl(traceId, includeEstimates))
  if (!res.ok) throw new Error(`Failed to load Cause Package: HTTP ${res.status}`)
  return res.json()
}

export async function fetchCaseComparison(
  a: string,
  b: string,
  includeEstimates = false,
): Promise<CaseComparison> {
  const query = new URLSearchParams({ a, b })
  if (includeEstimates) query.set("includeEstimates", "true")
  const res = await fetch(`/api/cases/compare?${query.toString()}`)
  if (!res.ok) throw new Error(`Failed to compare cases: HTTP ${res.status}`)
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
