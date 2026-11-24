# Architecture

## Goal

Keep one complete, local-only path from an imported failed trace to an evidence-linked Cause Package. Avoid abstractions that serve only hypothetical future features.

## Components

| Component | File | Responsibility |
|---|---|---|
| Event schema | `packages/server/src/schema.ts` | v2 event type, normalization helpers, redaction |
| Importer | `packages/server/src/importer.ts` | NDJSON/JSON parsing, normalization, redacted export |
| Analyzer | `packages/server/src/analyzer.ts` | Deterministic rules producing a Cause Package |
| Store | `packages/server/src/store.ts` | Local NDJSON persistence and event subscription |
| API server | `packages/server/src/index.ts` | Fastify routes, local binding, CORS, optional token |
| CLI | `packages/server/bin/cli.js`, `pipe.js` | `start`, `pipe`, `import`, `analyze` |
| SDK | `packages/sdk/src/index.ts` | Explicit event submission with redaction |
| Web UI | `packages/web/src/` | Cause Package view and replay view |

## Data flow

```text
Agent or export file
  -> SDK trace() / JSON Lines pipe / web paste
  -> POST /api/events or /api/import
  -> normalizeEvent() + redact()
  -> local NDJSON store (.agent-debugger/events.ndjson)
  -> analyzeTrace(traceId, events)
  -> GET /api/traces/:traceId/analysis
  -> Cause Package UI (evidence, candidates, reproduction, handoff)
  -> GET /api/traces/:traceId/export (redacted NDJSON)
```

No component calls an external service. The web UI talks only to the local API through the Vite proxy.

## Event contract (v2)

```ts
type AgentEvent = {
  schemaVersion: number
  id: string
  traceId: string
  parentId?: string
  type: "user" | "agent" | "tool" | "reasoning" | "system"
  name: string
  status?: "ok" | "error" | "unknown"
  error?: { kind?: string; message?: string }
  input?: unknown
  output?: unknown
  timestamp: number
  durationMs?: number
  tokens?: number
  cost?: number
  source?: { path?: string; line?: number; symbol?: string }
  attributes?: Record<string, unknown>
}
```

The importer also recognizes common OpenTelemetry and OpenInference attribute names for status, source location, and duration. Unknown shapes are mapped conservatively; they are never guessed as verified runtime facts.

## Analysis contract

The analyzer returns `observed`, `candidates`, `reproduction`, `handoff`, `unknowns`, and `metrics`. Each candidate carries `evidenceIds` and a `falsifier`. Confidence is derived from the number of supporting signals and is a rule output, not a probability or a model score.

## Redaction and trust

- Redaction runs on ingest, on SSE broadcast, and on NDJSON export.
- Secret-like keys, API-key patterns, bearer tokens, and email addresses are replaced.
- Invalid JSON Lines are reported by line number only; raw content is not logged.
- The server binds to `127.0.0.1` by default; CORS allows only local Vite origins.
- `AGENT_DEBUGGER_TOKEN` requires `x-agent-debugger-token` on mutating routes.
- Stored traces are treated as sensitive local data; `.agent-debugger/` is gitignored.

## Scale assumptions

Verified: none measured.

Design assumptions for the current code:

- Single developer, one local process, traces in the low thousands of events.
- The full trace for one `traceId` is loaded into memory for analysis.
- Writes rewrite the local NDJSON file; this is acceptable at the assumed scale and should be revisited before claiming support for long-running or high-volume sessions.

## Extension points

- Additional source formats should enter through `importer.ts` and produce the same v2 event type.
- Additional rules should live in `analyzer.ts` and produce the same analysis shape.
- A future DAP or MCP integration would consume `source` and `handoff` output; it must require explicit user control before attaching, evaluating, or modifying execution.

## Non-goals

- Live pause/inject or execution control
- Custom DAP server
- Cloud storage, accounts, or telemetry upload
- Eval and regression scoring
- External AI explanation by default
