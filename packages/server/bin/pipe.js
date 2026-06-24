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
//
// Each line must be a JSON object with at least "type" and "name", e.g.:
//   {"type": "tool", "name": "search", "input": "cats", "output": "..."}
//
// Optional fields: traceId, input, output, tokens, cost, timestamp.
// If traceId is omitted, all events from this pipe invocation share one
// auto-generated traceId so they group into a single trace in the UI.

import readline from "node:readline"
import fs from "node:fs"
import crypto from "node:crypto"

const SERVER_URL = process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"

export async function runPipe(filePath) {
  const sharedTraceId = `pipe-${Date.now()}`
  const input = filePath
    ? fs.createReadStream(filePath)
    : process.stdin

  const rl = readline.createInterface({ input, crlfDelay: Infinity })

  let sent = 0
  let failed = 0

  console.log(
    `[agent-debugger pipe] reading ${
      filePath ? `from ${filePath}` : "from stdin"
    }, sending to ${SERVER_URL}`
  )

  for await (const rawLine of rl) {
    const line = rawLine.trim()
    if (!line) continue

    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      console.warn(`[agent-debugger pipe] skipping invalid JSON line: ${line}`)
      failed++
      continue
    }

    if (!parsed.type || !parsed.name) {
      console.warn(
        `[agent-debugger pipe] skipping line missing "type" or "name": ${line}`
      )
      failed++
      continue
    }

    const event = {
      id: parsed.id ?? crypto.randomUUID(),
      traceId: parsed.traceId ?? sharedTraceId,
      type: parsed.type,
      name: parsed.name,
      input: parsed.input,
      output: parsed.output,
      tokens: parsed.tokens,
      cost: parsed.cost,
      timestamp: parsed.timestamp ?? Date.now(),
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      sent++
    } catch (err) {
      console.warn(
        `[agent-debugger pipe] failed to send event "${event.name}": ${
          err instanceof Error ? err.message : err
        }`
      )
      failed++
    }
  }

  console.log(
    `[agent-debugger pipe] done. sent=${sent} failed=${failed} traceId=${sharedTraceId}`
  )
}
