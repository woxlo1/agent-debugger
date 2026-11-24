# Agent Debugger

> Failed agent trace → evidence → reproduction → debugger handoff.

Agent Debugger is a local-first developer tool for investigating **failed** agent runs. It does not try to replace observability platforms such as Langfuse, Phoenix, or LangSmith. Instead, it takes a trace you already have and builds a **Cause Package**:

- **Observed evidence** — directly visible facts with event IDs
- **Cause candidates** — rule-based hypotheses, each with a falsifier
- **Reproduction steps** — what to replay and what to compare
- **Next debugger action** — where to stop and what to inspect in your existing debugger

Everything runs on your machine. No account, no cloud, no external AI service.

![status](https://img.shields.io/badge/status-alpha-orange)

## What this is / is not

| This build | Not included |
|---|---|
| Versioned event schema (`schemaVersion: 2`) | Live pause / inject |
| NDJSON / JSON trace import | Evals, datasets, scores |
| File-backed local event store | Cloud sync or accounts |
| Deterministic, rule-only Cause Package | External AI explanations |
| Redaction on ingest and export | Custom DAP/debugger implementation |

Cause candidates are **hypotheses derived from rules**, not verified root causes. The UI keeps observed facts, rule flags, hypotheses, reproduction steps, and handoff suggestions in separate sections.

## Quick start

```bash
git clone https://github.com/woxlo1/agent-debugger.git
cd agent-debugger
npm install
npm run dev
```

This starts:

- the local API on `http://127.0.0.1:4317`
- the Web UI on `http://localhost:5173`

Open `http://localhost:5173`. The **Cause Package** view is selected by default.

### Try the demo

In a second terminal while `npm run dev` is running:

```bash
npm run demo
```

The demo emits a fake failed checkout trace. Select it in the trace list and inspect its Cause Package, or switch to the **Replay** tab for the original timeline view.

A checked-in version of the same failure is available at `docs/examples/failed-trace.ndjson` for repeatable procedure checks. It is synthetic and contains no real customer data.

## Import an existing trace

```bash
# NDJSON / JSON Lines
agent-debugger import failed-run.jsonl

# From stdin
cat failed-run.jsonl | agent-debugger import

# Print the Cause Package as JSON
agent-debugger analyze <traceId>
```

You can also paste NDJSON into the **Cause Package** view and click **Import & select**.

Imported records are normalized into the v2 schema. Timestamps, status fields, error payloads, source locations, and token/cost fields are preserved when present. Secret-like keys, API-key patterns, bearer tokens, and email addresses are redacted on ingest and again on export.

## Instrumenting your own agent

The SDK is not published to npm yet. Use it from the workspace or send JSON Lines with the `pipe` command.

```ts
import { setTraceId, trace } from "./packages/sdk/src/index.ts"

setTraceId("checkout-agent-run-42")

await trace({
  type: "tool",
  name: "charge_card",
  input: { amount: 4200, currency: "JPY" },
  output: { success: false, error: "declined" },
  status: "error",
  source: { path: "src/tools/payments.ts", line: 88 },
})
```

`trace()` never throws; it returns `{ ok, event, error }`. Use `traceOrThrow()` when delivery failure must stop the run.

```ts
import { traceOrThrow } from "./packages/sdk/src/index.ts"

await traceOrThrow({ type: "agent", name: "final_answer", output: "..." })
```

### Any language via JSON Lines

```bash
# stdin
python3 your_agent.py | agent-debugger pipe

# file
agent-debugger pipe trace.jsonl

# explicit trace id
AGENT_DEBUGGER_TRACE_ID=run-42 agent-debugger pipe trace.jsonl
```

Minimum event:

```json
{"type":"tool","name":"search","input":"cats","output":"..."}
```

Optional v2 fields:

```json
{
  "type": "tool",
  "name": "search",
  "traceId": "run-42",
  "parentId": "step-7",
  "status": "error",
  "error": { "message": "timeout" },
  "source": { "path": "src/search.ts", "line": 31 },
  "durationMs": 5200,
  "attributes": { "retry_count": 3 }
}
```

Invalid lines are reported by line number only; raw line content is never logged.

## Event schema (v2)

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

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health, schema version, store path |
| POST | `/api/events` | Submit one v2 event |
| POST | `/api/import` | Import `{ content, format?, traceId? }` or `{ events }` |
| GET | `/api/traces` | List trace summaries |
| GET | `/api/events?traceId=...` | List events |
| GET | `/api/traces/:traceId/analysis` | Build the rule-based Cause Package |
| GET | `/api/traces/:traceId/export` | Download redacted NDJSON |
| POST | `/api/reset` | Clear the local store |
| GET | `/api/stream` | SSE stream of new events |

## Local security

- The server binds to `127.0.0.1` by default.
- CORS allows only `http://localhost:5173` and `http://127.0.0.1:5173` by default.
- Set `AGENT_DEBUGGER_ALLOWED_ORIGINS` to override the browser-origin allowlist.
- Set `AGENT_DEBUGGER_TOKEN` to require `x-agent-debugger-token` on all mutating APIs.
- Events are stored in `.agent-debugger/events.ndjson` by default; override with `AGENT_DEBUGGER_STORE`.
- Redaction is applied on import, event submission, SSE output, and NDJSON export.

## Rules currently implemented

The analyzer emits evidence for:

- explicit `status: "error"` or `error` payloads
- tool results containing `isError`, `success: false`, or an `error` field
- identical tool calls repeated three or more times
- tool calls without a captured output
- the last known good event before the first failure
- tool durations exceeding three times the median
- runs ending on a reasoning step without a final answer

Each candidate includes a falsifier so it can be challenged rather than trusted.

## Architecture

```
Your agent
   │  trace() / JSON Lines
   ▼
agent-debugger server
   ├─ importer.ts      normalize + redact
   ├─ store.ts         local NDJSON persistence
   └─ analyzer.ts      rule-based Cause Package
   ▼
agent-debugger web
   ├─ Cause Package view
   └─ Replay view
```

## Monorepo layout

```
packages/
  server/          Fastify API, importer, analyzer, local store, CLI
  sdk/             TypeScript event client
  web/             React + Vite + Tailwind UI
  example-agent/   Demo trace emitter
```

## Verification

```bash
npm run verify
```

This runs the JavaScript syntax checks, TypeScript checks, tests, and the web build. No dependency install is performed by this repository's scripts.

See `docs/PRODUCT_BRIEF.md`, `docs/ARCHITECTURE.md`, and `docs/VALIDATION_PLAN.md` for scope, design, and the unexecuted validation plan.

## License

MIT
