import type { AgentEvent } from "./schema.js"

export type EvidenceKind =
  | "status_error"
  | "error_return"
  | "repeated_call"
  | "missing_result"
  | "last_success"
  | "duration_outlier"
  | "unfinished_run"

export type Evidence = {
  id: string
  kind: EvidenceKind
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

export type ReproductionStep = {
  step: number
  instruction: string
  eventId?: string
}

export type HandoffStep = {
  tool: string
  command: string
  note: string
}

export type Analysis = {
  schemaVersion: number
  traceId: string
  generatedAt: number
  basedOn: "rule-based-v1"
  observed: Evidence[]
  candidates: CauseCandidate[]
  reproduction: ReproductionStep[]
  handoff: HandoffStep[]
  unknowns: string[]
  metrics: {
    eventCount: number
    toolCalls: number
    errorEvents: number
  }
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return String(value)
  }
}

function outputErrorFlag(event: AgentEvent): string | null {
  if (!event.output || typeof event.output !== "object") return null
  const output = event.output as Record<string, unknown>
  if (output.isError === true) return "isError=true"
  if (output.success === false) return "success=false"
  if (output.error !== undefined && output.error !== null && output.error !== false) {
    return "error field present"
  }
  return null
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function confidenceFor(count: number): CauseCandidate["confidence"] {
  if (count >= 3) return "high"
  if (count >= 1) return "medium"
  return "low"
}

/** Deterministic, rule-based Cause Package. No AI/model call is involved. */
export function analyzeTrace(traceId: string, events: AgentEvent[]): Analysis {
  const observed: Evidence[] = []
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const toolEvents = ordered.filter((event) => event.type === "tool")

  const statusErrors = ordered.filter(
    (event) => event.status === "error" || event.error !== undefined,
  )
  if (statusErrors.length > 0) {
    observed.push({
      id: "ev-status-error",
      kind: "status_error",
      label: "Steps marked as errors",
      detail: `${statusErrors.length} event(s) carry an explicit error status.`,
      eventIds: statusErrors.map((event) => event.id),
    })
  }

  const errorReturns = toolEvents.filter((event) => outputErrorFlag(event) !== null)
  if (errorReturns.length > 0) {
    observed.push({
      id: "ev-error-return",
      kind: "error_return",
      label: "Tools returned errors without throwing",
      detail: errorReturns
        .map((event) => `${event.name}: ${outputErrorFlag(event)}`)
        .join("; "),
      eventIds: errorReturns.map((event) => event.id),
    })
  }

  const groups = new Map<string, AgentEvent[]>()
  for (const event of toolEvents) {
    const key = `${event.name}::${stableStringify(event.input)}`
    const group = groups.get(key) ?? []
    group.push(event)
    groups.set(key, group)
  }
  const repeated = [...groups.values()].filter((group) => group.length >= 3)
  if (repeated.length > 0) {
    const flattened = repeated.flat()
    observed.push({
      id: "ev-repeated-call",
      kind: "repeated_call",
      label: "Identical tool calls repeated",
      detail: repeated
        .map(
          (group) =>
            `${group[0].name} called ${group.length} times with identical input`,
        )
        .join("; "),
      eventIds: flattened.map((event) => event.id),
    })
  }

  const missingResults = toolEvents.filter(
    (event) => event.output === undefined && event.status !== "error",
  )
  if (missingResults.length > 0) {
    observed.push({
      id: "ev-missing-result",
      kind: "missing_result",
      label: "Tool calls with no captured result",
      detail: `${missingResults.length} tool call(s) have no output field.`,
      eventIds: missingResults.map((event) => event.id),
    })
  }

  const firstFailure =
    statusErrors[0] ??
    errorReturns[0] ??
    repeated.flat()[0] ??
    missingResults[0]
  const lastSuccess = [...ordered]
    .reverse()
    .find(
      (event) =>
        event.status === "ok" ||
        (event.output !== undefined && outputErrorFlag(event) === null),
    )
  if (lastSuccess && (!firstFailure || lastSuccess.timestamp <= firstFailure.timestamp)) {
    observed.push({
      id: "ev-last-success",
      kind: "last_success",
      label: "Last known good state",
      detail: `Last event with a usable output was "${lastSuccess.name}".`,
      eventIds: [lastSuccess.id],
    })
  }

  const durations = toolEvents
    .map((event) => event.durationMs)
    .filter((value): value is number => typeof value === "number" && value > 0)
  const baseline = median(durations)
  const outliers = baseline
    ? durations.length >= 3
      ? toolEvents.filter(
          (event) =>
            typeof event.durationMs === "number" &&
            event.durationMs > baseline * 3 &&
            event.durationMs > 1000,
        )
      : []
    : []
  if (outliers.length > 0) {
    observed.push({
      id: "ev-duration-outlier",
      kind: "duration_outlier",
      label: "Slow tool calls",
      detail: `Median tool duration ${Math.round(baseline ?? 0)}ms; ${outliers.length} call(s) exceeded 3x median.`,
      eventIds: outliers.map((event) => event.id),
    })
  }

  if (ordered.length > 0 && ordered[ordered.length - 1].type === "reasoning") {
    observed.push({
      id: "ev-unfinished",
      kind: "unfinished_run",
      label: "Run ends on reasoning without a final answer",
      detail: "The last recorded event has type reasoning.",
      eventIds: [ordered[ordered.length - 1].id],
    })
  }

  const candidates: CauseCandidate[] = []
  const pushCandidate = (
    id: string,
    label: string,
    evidenceIds: string[],
    falsifier: string,
  ) => {
    if (evidenceIds.length === 0) return
    candidates.push({
      id,
      label,
      confidence: confidenceFor(evidenceIds.length),
      evidenceIds,
      falsifier,
    })
  }

  pushCandidate(
    "cand-error",
    "A tool or step reported an error",
    [
      ...(observed.find((item) => item.id === "ev-status-error")?.eventIds ?? []),
      ...(observed.find((item) => item.id === "ev-error-return")?.eventIds ?? []),
    ],
    "The same input succeeds when the tool is called directly.",
  )
  pushCandidate(
    "cand-loop",
    "The agent looped on identical tool arguments",
    observed.find((item) => item.id === "ev-repeated-call")?.eventIds ?? [],
    "The run reaches a final answer after the first identical call.",
  )
  pushCandidate(
    "cand-missing",
    "A tool result was never captured",
    observed.find((item) => item.id === "ev-missing-result")?.eventIds ?? [],
    "The instrumented tool is confirmed to emit an output field.",
  )
  pushCandidate(
    "cand-slow",
    "A slow tool call may have timed out upstream",
    observed.find((item) => item.id === "ev-duration-outlier")?.eventIds ?? [],
    "The upstream timeout is longer than the observed duration.",
  )

  if (candidates.length === 0) {
    candidates.push({
      id: "cand-unknown",
      label: "No rule-based cause detected; manual inspection required",
      confidence: "low",
      evidenceIds: lastSuccess ? [lastSuccess.id] : [],
      falsifier: "A new rule or manual inspection finds a concrete failure.",
    })
  }

  const reproduction: ReproductionStep[] = [
    {
      step: 1,
      instruction: `Load trace ${traceId} from the local store or import its NDJSON export.`,
    },
  ]
  if (firstFailure) {
    reproduction.push({
      step: reproduction.length + 1,
      instruction: `Replay events up to "${firstFailure.name}" without changing captured inputs.`,
      eventId: firstFailure.id,
    })
  }
  if (lastSuccess) {
    reproduction.push({
      step: reproduction.length + 1,
      instruction: `Compare the failing input with the last good event "${lastSuccess.name}".`,
      eventId: lastSuccess.id,
    })
  }
  if (repeated.length > 0) {
    reproduction.push({
      step: reproduction.length + 1,
      instruction:
        "Substitute the repeated tool's result with the last successful value and continue; check whether the loop stops.",
      eventId: repeated[0][0].id,
    })
  }

  const handoff: HandoffStep[] = []
  const source = firstFailure?.source ?? toolEvents.find((event) => event.source)?.source
  if (source?.path) {
    const location = source.line ? `${source.path}:${source.line}` : source.path
    handoff.push({
      tool: "generic-dap",
      command: `set breakpoint ${location}; inspect locals at ${firstFailure?.name ?? "this call"}`,
      note: "Hand this location to your existing debugger (VS Code, CLion, or an MCP debugger bridge).",
    })
  }
  if (firstFailure?.type === "tool" || toolEvents.length > 0) {
    handoff.push({
      tool: "mcp-debugger",
      command: `mcp-debugger start --break "${firstFailure?.name ?? toolEvents[0].name}"`,
      note: "Stop at the tool boundary before arguments are consumed.",
    })
  }
  handoff.push({
    tool: "agent-debugger",
    command: `agent-debugger pipe <trace-${traceId}.ndjson>`,
    note: "Re-import the redacted evidence bundle for a fresh local inspection.",
  })

  const unknowns: string[] = []
  if (!source?.path) unknowns.push("No source location in trace; cannot point to a code line.")
  if (!ordered.some((event) => event.parentId)) {
    unknowns.push("No parentId values; call hierarchy is unknown.")
  }
  if (!ordered.some((event) => event.status && event.status !== "unknown")) {
    unknowns.push("No explicit status fields; error inference relies on payload shapes.")
  }

  return {
    schemaVersion: 1,
    traceId,
    generatedAt: Date.now(),
    basedOn: "rule-based-v1",
    observed,
    candidates,
    reproduction,
    handoff,
    unknowns,
    metrics: {
      eventCount: ordered.length,
      toolCalls: toolEvents.length,
      errorEvents: statusErrors.length + errorReturns.length,
    },
  }
}
