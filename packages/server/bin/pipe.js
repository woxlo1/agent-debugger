// agent-debugger pipe
//
// Reads newline-delimited JSON (JSON Lines) from stdin or a file and POSTs
// each line to the local server as an event. This lets any language
// (Python, Go, Ruby, shell scripts, ...) send traces without needing the
// TypeScript SDK — just print one JSON object per line.
//
// Usage:
//   agent-debugger pipe                 # reads from stdin
//   agent-debugger pipe events.jsonl    # reads from a file
//   AGENT_DEBUGGER_TRACE_ID=run-1 agent-debugger pipe events.jsonl
//
// Each line must be a JSON object with at least "type" and "name", e.g.:
//   {"type": "tool", "name": "search", "input": "cats", "output": "..."}
//
// Optional v2 fields: traceId, parentId, status, error, source, durationMs,
// input, output, tokens, cost, timestamp, attributes.

import readline from "node:readline"
import fs from "node:fs"
import crypto from "node:crypto"

const SERVER_URL = process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"
const TOKEN = process.env.AGENT_DEBUGGER_TOKEN

export async function runPipe(filePath) {
  const sharedTraceId =
    process.env.AGENT_DEBUGGER_TRACE_ID ?? `pipe-${Date.now()}`
  const input = filePath ? fs.createReadStream(filePath) : process.stdin

  const rl = readline.createInterface({ input, crlfDelay: Infinity })

  let sent = 0
  let failed = 0
  let lineNumber = 0

  console.log(
    `[agent-debugger pipe] reading ${
      filePath ? `from ${filePath}` : "from stdin"
    }, sending to ${SERVER_URL}`,
  )

  for await (const rawLine of rl) {
    lineNumber++
    const line = rawLine.trim()
    if (!line) continue

    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      console.warn(
        `[agent-debugger pipe] line ${lineNumber}: invalid JSON (content omitted)`,
      )
      failed++
      continue
    }

    if (!parsed || typeof parsed !== "object" || !parsed.type || !parsed.name) {
      console.warn(
        `[agent-debugger pipe] line ${lineNumber}: missing required "type" or "name" (content omitted)`,
      )
      failed++
      continue
    }

    const event = {
      schemaVersion: 2,
      id: parsed.id ?? crypto.randomUUID(),
      traceId: parsed.traceId ?? sharedTraceId,
      parentId: parsed.parentId,
      type: parsed.type,
      name: parsed.name,
      status: parsed.status,
      error: parsed.error,
      source: parsed.source,
      durationMs: parsed.durationMs,
      input: parsed.input,
      output: parsed.output,
      tokens: parsed.tokens,
      cost: parsed.cost,
      timestamp: parsed.timestamp ?? Date.now(),
      attributes: parsed.attributes,
    }

    const headers = { "Content-Type": "application/json" }
    if (TOKEN) headers["x-agent-debugger-token"] = TOKEN

    try {
      const res = await fetch(`${SERVER_URL}/api/events`, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      sent++
    } catch (err) {
      console.warn(
        `[agent-debugger pipe] failed to send event "${event.name}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      failed++
    }
  }

  console.log(
    `[agent-debugger pipe] done. sent=${sent} failed=${failed} traceId=${sharedTraceId}`,
  )
}

export async function runImport(filePath) {
  const content = filePath
    ? fs.readFileSync(filePath, "utf8")
    : await new Promise((resolve, reject) => {
        let text = ""
        process.stdin.setEncoding("utf8")
        process.stdin.on("data", (chunk) => (text += chunk))
        process.stdin.on("end", () => resolve(text))
        process.stdin.on("error", reject)
      })

  const headers = { "Content-Type": "application/json" }
  if (TOKEN) headers["x-agent-debugger-token"] = TOKEN

  // The file is intentionally imported to the local debugger server.
  // SERVER_URL defaults to http://127.0.0.1:4317.
  const res = await fetch(`${SERVER_URL}/api/import`, {
    method: "POST",
    headers,
    // codeql[js/file-access-to-http]
    body: JSON.stringify({ content, format: "ndjson" }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  console.log(
    `[agent-debugger import] traceId=${body.traceId} imported=${body.imported} added=${body.added} skipped=${body.skipped}`,
  )
}
