import Fastify from "fastify"
import cors from "@fastify/cors"
import crypto from "node:crypto"
import { store } from "./store.js"
import type { AgentEvent } from "./types.js"

const PORT = Number(process.env.AGENT_DEBUGGER_PORT ?? 4317)

const app = Fastify({ logger: false })

await app.register(cors, { origin: true })

// Health check
app.get("/api/health", async () => ({ ok: true }))

// Receive an event from the SDK (or curl / stdin bridge)
app.post("/api/events", async (req, reply) => {
  const body = req.body as Partial<AgentEvent>

  if (!body.type || !body.name) {
    reply.code(400)
    return { error: "type and name are required" }
  }

  const event: AgentEvent = {
    id: body.id ?? crypto.randomUUID(),
    traceId: body.traceId ?? "default",
    type: body.type as AgentEvent["type"],
    name: body.name,
    input: body.input,
    output: body.output,
    timestamp: body.timestamp ?? Date.now(),
    tokens: body.tokens,
    cost: body.cost,
  }

  store.add(event)
  reply.code(201)
  return event
})

// List all traces (summary view, used for a "trace picker" in the UI)
app.get("/api/traces", async () => {
  return store.traces()
})

// List events for a given trace (or all events if no traceId given)
app.get("/api/events", async (req) => {
  const { traceId } = req.query as { traceId?: string }
  return store.list(traceId)
})

// Clear everything (handy for demos)
app.post("/api/reset", async () => {
  store.clear()
  return { ok: true }
})

// Server-Sent Events stream so the UI updates live as new events arrive.
app.get("/api/stream", async (req, reply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })

  const send = (event: AgentEvent) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const unsubscribe = store.subscribe(send)

  req.raw.on("close", () => {
    unsubscribe()
  })
})

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`\n  agent-debugger server running at http://localhost:${PORT}`)
  console.log(`  -> POST events to http://localhost:${PORT}/api/events\n`)
})
