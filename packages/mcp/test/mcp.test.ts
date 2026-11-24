import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

type RpcResponse = {
  id: number
  result?: Record<string, any>
  error?: { code: number; message: string }
}

async function runMcp(
  requests: Array<Record<string, unknown>>,
  env: Record<string, string>,
): Promise<RpcResponse[]> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "packages/mcp/src/index.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    },
  )
  let output = ""
  let stderr = ""
  child.stdout.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    output += chunk
  })
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk
  })

  const closed = new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", () => resolve())
  })
  child.stdin.end(`${requests.map((request) => JSON.stringify(request)).join("\n")}\n`)
  await closed

  if (stderr.length > 0) throw new Error(`MCP server wrote to stderr: ${stderr}`)
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RpcResponse)
}

async function run() {
  const temp = mkdtempSync(path.join(os.tmpdir(), "ad-mcp-test-"))
  const storePath = path.join(temp, "events.ndjson")
  const events = [
    {
      schemaVersion: 2,
      id: "mcp-a-1",
      traceId: "mcp-trace-a",
      type: "tool",
      name: "charge",
      status: "error",
      input: { apiKey: "sk-should-not-leak" },
      output: { success: false, error: "declined" },
      timestamp: 1,
      source: { path: "src/payments.ts", line: 10 },
    },
    {
      schemaVersion: 2,
      id: "mcp-a-2",
      traceId: "mcp-trace-a",
      type: "reasoning",
      name: "think",
      timestamp: 2,
    },
    {
      schemaVersion: 2,
      id: "mcp-b-1",
      traceId: "mcp-trace-b",
      type: "tool",
      name: "lookup",
      status: "ok",
      output: { ok: true },
      timestamp: 3,
    },
  ]
  writeFileSync(
    storePath,
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    "utf8",
  )

  try {
    const responses = await runMcp(
      [
        { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "analyze_trace", arguments: { traceId: "mcp-trace-a" } },
        },
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "compare_traces",
            arguments: { traceIdA: "mcp-trace-a", traceIdB: "mcp-trace-b" },
          },
        },
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "get_cause_package", arguments: { traceId: "mcp-trace-a" } },
        },
        { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "does_not_exist" } },
        { jsonrpc: "2.0", id: 7, method: "unknown/method" },
      ],
      {
        AGENT_DEBUGGER_STORE: storePath,
        AGENT_DEBUGGER_CLAUDE_LOCAL: "disabled",
      },
    )

    const byId = new Map(responses.map((response) => [response.id, response]))
    assert.equal(byId.size, 7)

    const init = byId.get(1)!.result!
    assert.equal(init.protocolVersion, "2025-06-18")
    assert.equal(init.serverInfo.name, "agent-debugger-mcp")
    assert.equal(init.capabilities.tools.listChanged, false)

    const names = byId.get(2)!.result!.tools.map((tool: { name: string }) => tool.name)
    assert.ok(names.includes("analyze_trace"))
    assert.ok(names.includes("get_cause_package"))
    assert.ok(names.includes("read_claude_local_usage"))

    const analysisText = byId.get(3)!.result!.content[0].text
    const analysis = JSON.parse(analysisText)
    assert.equal(analysis.traceId, "mcp-trace-a")
    assert.ok(analysis.observed.some((item: { kind: string }) => item.kind === "status_error"))
    assert.equal(analysisText.includes("sk-should-not-leak"), false)

    const comparisonText = byId.get(4)!.result!.content[0].text
    assert.equal(JSON.parse(comparisonText).kind, "case-comparison")

    const packageText = byId.get(5)!.result!.content[0].text
    const packageValue = JSON.parse(packageText)
    assert.equal(packageValue.kind, "cause-package")
    assert.equal(packageValue.fingerprint.length, 64)
    assert.equal(packageText.includes("sk-should-not-leak"), false)

    assert.equal(byId.get(6)!.result!.isError, true)
    assert.equal(byId.get(7)!.error?.code, -32601)

    console.log("mcp protocol tests ok")
  } finally {
    rmSync(temp, { force: true, recursive: true })
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
