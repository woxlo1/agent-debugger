#!/usr/bin/env node
// Minimal CLI. "agent-debugger start" boots the local server.
// "agent-debugger pipe" reads JSON Lines from stdin/file and forwards them
// to the server, so any language can send traces without an SDK.
import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { runPipe, runImport } from "./pipe.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const command = process.argv[2] ?? "start"

if (command === "pipe") {
  const failed = await runPipe(process.argv[3])
  process.exit(failed > 0 ? 1 : 0)
}

if (command === "import") {
  await runImport(process.argv[3])
  process.exit(0)
}

if (command === "analyze") {
  const traceId = process.argv[3]
  if (!traceId) {
    console.log("Usage: agent-debugger analyze <traceId>")
    process.exit(1)
  }
  const res = await fetch(
    `${process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"}/api/traces/${encodeURIComponent(traceId)}/analysis`,
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(body.error ?? `HTTP ${res.status}`)
    process.exit(1)
  }
  console.log(JSON.stringify(body, null, 2))
  process.exit(0)
}

if (command === "usage") {
  const traceId = process.argv[3]
  if (!traceId) {
    console.log("Usage: agent-debugger usage <traceId> [--include-estimates]")
    process.exit(1)
  }
  const includeEstimates = process.argv.includes("--include-estimates")
  const query = includeEstimates ? "?includeEstimates=true" : ""
  const res = await fetch(
    `${process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"}/api/traces/${encodeURIComponent(traceId)}/usage${query}`,
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(body.error ?? `HTTP ${res.status}`)
    process.exit(1)
  }
  console.log(JSON.stringify(body, null, 2))
  process.exit(0)
}

if (command === "privacy") {
  const traceId = process.argv[3]
  if (!traceId) {
    console.log("Usage: agent-debugger privacy <traceId>")
    process.exit(1)
  }
  const res = await fetch(
    `${process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"}/api/traces/${encodeURIComponent(traceId)}/privacy`,
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(body.error ?? `HTTP ${res.status}`)
    process.exit(1)
  }
  console.log(JSON.stringify(body, null, 2))
  process.exit(0)
}

if (command === "package") {
  const traceId = process.argv[3]
  if (!traceId) {
    console.log("Usage: agent-debugger package <traceId> [output.json] [--include-estimates]")
    process.exit(1)
  }
  const includeEstimates = process.argv.includes("--include-estimates")
  const output = process.argv.slice(4).find((arg) => !arg.startsWith("--"))
  const query = includeEstimates ? "?includeEstimates=true" : ""
  const res = await fetch(
    `${process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"}/api/traces/${encodeURIComponent(traceId)}/package${query}`,
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(body.error ?? `HTTP ${res.status}`)
    process.exit(1)
  }
  const text = JSON.stringify(body, null, 2)
  if (output) {
    await writeFile(output, `${text}\n`, "utf8")
    console.log(`[agent-debugger package] wrote ${output}`)
  } else {
    console.log(text)
  }
  process.exit(0)
}

if (command === "compare") {
  const a = process.argv[3]
  const b = process.argv[4]
  if (!a || !b) {
    console.log("Usage: agent-debugger compare <traceIdA> <traceIdB> [--include-estimates]")
    process.exit(1)
  }
  const includeEstimates = process.argv.includes("--include-estimates")
  const query = new URLSearchParams({ a, b })
  if (includeEstimates) query.set("includeEstimates", "true")
  const res = await fetch(
    `${process.env.AGENT_DEBUGGER_URL ?? "http://localhost:4317"}/api/cases/compare?${query.toString()}`,
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(body.error ?? `HTTP ${res.status}`)
    process.exit(1)
  }
  console.log(JSON.stringify(body, null, 2))
  process.exit(0)
}

if (command !== "start") {
  console.log("Usage:")
  console.log("  agent-debugger start             Start the local server + UI backend")
  console.log("  agent-debugger pipe [file]       Send JSON Lines events from stdin or a file")
  console.log("  agent-debugger import [file]     Import an NDJSON trace export")
  console.log("  agent-debugger analyze <traceId> Print the rule-based Cause Package")
  console.log("  agent-debugger package <traceId> [output.json]")
  console.log("                                   Export a redacted portable Cause Package")
  console.log("  agent-debugger compare <a> <b>    Compare two traces")
  console.log("  agent-debugger usage <traceId>   Print the AI usage ledger")
  console.log("  agent-debugger privacy <traceId> Print the privacy audit")
  process.exit(1)
}

const serverEntry = path.join(
  __dirname,
  "..",
  "dist",
  "packages",
  "server",
  "src",
  "index.js",
)

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code) => process.exit(code ?? 0))
