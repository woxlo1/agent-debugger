# Agent Debugger

> Chrome DevTools for LLM agents.

Agent Debugger is a local-first developer tool that lets you **visualize and replay** what your AI agent thought, which tools it called, and in what order it made decisions.

![status](https://img.shields.io/badge/status-MVP-orange)

## Why

Debugging an LLM agent today means scrolling through raw console logs or JSON blobs. Agent Debugger gives you a timeline you can **play, pause, and step through** — like a debugger, but for agent reasoning.

## Quick start

```bash
git clone https://github.com/woxlo1/agent-debugger.git
cd agent-debugger
npm install
npm run dev
```

This starts:
- the local server on `http://localhost:4317`
- the Web UI on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

### See it in action with one command

In a second terminal (while `npm run dev` is running):

```bash
npm run demo
```

This emits a realistic fake agent trace using the SDK, which appears live in the UI. Select it from the trace list on the left and hit **Play**.

## Instrumenting your own agent

Install the SDK in your agent project:

```bash
npm install agent-debugger-sdk
```

```ts
import { trace, setTraceId } from "agent-debugger-sdk"

setTraceId("my-agent-run-1")

await trace({
  type: "user",
  name: "user_input",
  input: "What's the weather in Tokyo?",
})

await trace({
  type: "tool",
  name: "get_weather",
  input: { city: "Tokyo" },
  output: { tempC: 23, condition: "rain" },
})

await trace({
  type: "agent",
  name: "final_answer",
  output: "It's 23°C and raining in Tokyo.",
})
```

Events show up live in the Web UI as soon as `agent-debugger start` (or `npm run dev`) is running.

## Using Agent Debugger from any language (no SDK required)

The TypeScript SDK is just a thin wrapper around one HTTP call. If your agent is written in Python, Go, Ruby, or anything else, use the `pipe` command instead: print one JSON object per line (JSON Lines) and pipe it in.

```bash
agent-debugger pipe                 # reads from stdin
agent-debugger pipe trace.jsonl     # reads from a file
```

Each line needs at least `type` and `name`:

```json
{"type": "tool", "name": "search", "input": "cats", "output": "..."}
```

Example from Python:

```python
import json

def emit(event):
    print(json.dumps(event), flush=True)

emit({"type": "user", "name": "user_input", "input": "What's the weather in Tokyo?"})
emit({"type": "tool", "name": "get_weather", "input": {"city": "Tokyo"}, "output": {"tempC": 23}})
emit({"type": "agent", "name": "final_answer", "output": "It's 23°C in Tokyo."})
```

```bash
python3 your_agent.py | agent-debugger pipe
```

All events piped in a single run share an auto-generated `traceId` unless you set your own per-event `traceId` field, so they group into one trace in the UI. A runnable version of this example lives at `packages/example-agent/demo_pipe.py`.

## Architecture

```
Your Agent App
     │  trace({...})
     ▼
agent-debugger-sdk  (HTTP POST)
     │
     ▼
agent-debugger-server  (Fastify, in-memory store, SSE stream)
     │  Server-Sent Events
     ▼
agent-debugger-web  (React + Vite, Replay UI)
```

## Monorepo layout

```
packages/
  server/          # Fastify server: receives events, serves SSE stream
  sdk/              # TypeScript SDK: trace() client
  web/              # React + Vite + Tailwind Replay UI
  example-agent/   # Demo script for `npm run demo`
```

## Event data model

```ts
type AgentEvent = {
  id: string
  traceId: string
  type: "user" | "agent" | "tool" | "reasoning"
  name: string
  input?: unknown
  output?: unknown
  timestamp: number
  tokens?: number
  cost?: number
}
```

## API (server)

| Method | Path           | Description                              |
|--------|----------------|-------------------------------------------|
| POST   | `/api/events`  | Submit a new event                        |
| GET    | `/api/events`  | List events (optionally `?traceId=...`)   |
| GET    | `/api/traces`  | List trace summaries                      |
| GET    | `/api/stream`  | Server-Sent Events stream of new events   |
| POST   | `/api/reset`   | Clear all stored events                   |
| GET    | `/api/health`  | Health check                              |

## CLI

```bash
agent-debugger start            # start the local server (same as npm run dev -w packages/server)
agent-debugger pipe [file]      # send JSON Lines events from stdin or a file
```

## Roadmap (v0.3+)

- Persist traces to disk (SQLite) instead of in-memory only
- Token/cost rollups per trace, cost charts
- Diff view: compare two traces of the same prompt side by side
- Export/share a trace as a single JSON file or shareable link
- Multi-agent / sub-agent nesting in the timeline
- VS Code extension embedding the same Replay UI

## License

MIT
