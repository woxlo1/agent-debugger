import Fastify from "fastify"
import cors from "@fastify/cors"
import type { AiUsage, ConsentState, CostSource } from "../../shared/src/index.js"
import { buildUsageLedger } from "../../usage/src/index.js"
import { store, STORE_PATH, USAGE_STORE_PATH } from "./store.js"
import { analyzeTrace } from "./analyzer.js"
import { exportNdjson, importTrace, type ImportFormat } from "./importer.js"
import { normalizeEvent, redact, SCHEMA_VERSION } from "./schema.js"
import {
  auditPrivacy,
  normalizeUsagePayload,
  sanitizeUsageEntry,
} from "./usage.js"

const PORT = Number(process.env.AGENT_DEBUGGER_PORT ?? 4317)
const HOST = process.env.AGENT_DEBUGGER_HOST ?? "127.0.0.1"
const TOKEN = process.env.AGENT_DEBUGGER_TOKEN
const ALLOWED_ORIGINS = (
  process.env.AGENT_DEBUGGER_ALLOWED_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((value: string) => value.trim())
  .filter(Boolean)

const app = Fastify({ logger: false })

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true)
    else callback(null, false)
  },
})

// Mutating endpoints are protected when a token is configured.
app.addHook("onRequest", async (request, reply) => {
  if (!TOKEN) return
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return
  if (request.headers["x-agent-debugger-token"] === TOKEN) return
  reply.code(401)
  return reply.send({ error: "Unauthorized" })
})

// Minimal in-memory limiter for the local debugger. No dependency is added.
type LimiterReply = { code: (status: number) => { send: (body: unknown) => unknown } }

function createRateLimiter(max: number, windowMs: number, label: string) {
  const hits = new Map<string, number[]>()
  return (
    request: { ip: string },
    reply: LimiterReply,
    done: () => void,
  ): void => {
    const now = Date.now()
    const recent = (hits.get(request.ip) ?? []).filter((time) => now - time < windowMs)
    if (recent.length >= max) {
      reply.code(429).send({ error: `Too many ${label} requests` })
      return
    }
    recent.push(now)
    hits.set(request.ip, recent)
    done()
  }
}

const limitReset = createRateLimiter(5, 60_000, "reset")
const limitUsageIngest = createRateLimiter(30, 60_000, "usage ingest")

app.get("/api/health", async () => ({
  ok: true,
  schemaVersion: SCHEMA_VERSION,
  store: STORE_PATH,
  usageStore: USAGE_STORE_PATH,
}))

app.post("/api/events", async (request, reply) => {
  const body = request.body as Record<string, unknown> | null
  const event = normalizeEvent(body ?? {}, "default")
  if (!event) {
    reply.code(400)
    return { error: "name is required" }
  }
  store.add(event)
  reply.code(201)
  return event
})

app.post("/api/import", async (request, reply) => {
  const body = (request.body ?? {}) as {
    content?: string
    events?: unknown[]
    format?: ImportFormat
    traceId?: string
  }

  const result = importTrace(body)
  if (result.imported === 0 && result.skipped > 0) {
    reply.code(400)
    return {
      error: "No valid events found",
      traceId: result.traceId,
      skipped: result.skipped,
    }
  }

  const added = store.addMany(result.events)
  return {
    traceId: result.traceId,
    imported: result.imported,
    added,
    skipped: result.skipped,
  }
})

app.post(
  "/api/usage",
  {
    preHandler: limitUsageIngest,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  },
  async (request) => {
    const body = (request.body ?? {}) as {
      entries?: unknown[]
      source?: string
      payload?: unknown
      traceId?: string
      eventId?: string
      consent?: ConsentState
      observedAt?: number
      durationMs?: number
      cost?: number
      costSource?: CostSource
    }

    let candidates: AiUsage[] = []
    let rejected = 0

    if (Array.isArray(body.entries)) {
      const sanitized = body.entries.map(sanitizeUsageEntry)
      candidates = sanitized.filter((entry): entry is AiUsage => entry !== null)
      rejected = sanitized.length - candidates.length
    } else {
      const normalized = normalizeUsagePayload({
        source: body.source ?? "unknown",
        payload: body.payload,
        traceId: body.traceId,
        eventId: body.eventId,
        consent: body.consent,
        observedAt: body.observedAt,
        durationMs: body.durationMs,
        cost: body.cost,
        costSource: body.costSource,
      })
      if (normalized) candidates = [normalized]
      else rejected = 1
    }

    const added = store.addUsage(candidates)
    return { added, rejected, duplicates: candidates.length - added }
  },
)

app.get("/api/traces/:traceId/usage", async (request) => {
  const { traceId } = request.params as { traceId: string }
  const { includeEstimates } = request.query as { includeEstimates?: string }
  return buildUsageLedger(traceId, store.usages(traceId), {
    includeEstimates: includeEstimates === "true",
  })
})

app.get("/api/traces/:traceId/privacy", async (request) => {
  const { traceId } = request.params as { traceId: string }
  return auditPrivacy(store.usages(traceId))
})

app.get("/api/traces", async () => store.traces())

app.get("/api/events", async (request) => {
  const { traceId } = request.query as { traceId?: string }
  return store.list(traceId)
})

app.get("/api/traces/:traceId/analysis", async (request, reply) => {
  const { traceId } = request.params as { traceId: string }
  const events = store.list(traceId)
  if (events.length === 0) {
    reply.code(404)
    return { error: `Unknown traceId: ${traceId}` }
  }
  return analyzeTrace(traceId, events)
})

app.get("/api/traces/:traceId/export", async (request, reply) => {
  const { traceId } = request.params as { traceId: string }
  const events = store.list(traceId)
  if (events.length === 0) {
    reply.code(404)
    return { error: `Unknown traceId: ${traceId}` }
  }
  reply.header("Content-Type", "application/x-ndjson; charset=utf-8")
  reply.header(
    "Content-Disposition",
    `attachment; filename="trace-${traceId}.ndjson"`,
  )
  return exportNdjson(events)
})

app.post(
  "/api/reset",
  {
    preHandler: limitReset,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  },
  async () => {
    store.clear()
    return { ok: true }
  },
)

app.get("/api/stream", async (request, reply) => {
  reply.hijack()
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })
  reply.raw.write(": connected\n\n")

  const send = (event: unknown) => {
    reply.raw.write(`data: ${JSON.stringify(redact(event))}\n\n`)
  }

  const unsubscribe = store.subscribe(send)
  request.raw.on("close", () => unsubscribe())
})

app.listen({ port: PORT, host: HOST }).then(() => {
  console.log(`\n  agent-debugger running at http://${HOST}:${PORT}`)
  console.log(`  store: ${STORE_PATH}`)
  console.log(`  schema version: ${SCHEMA_VERSION}`)
  if (TOKEN) console.log("  mutating APIs require x-agent-debugger-token")
  console.log("")
})
