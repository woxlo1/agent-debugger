import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getFreePort } from "./freePort.ts"

let port = 0
let base = ""
let storePath = ""
let usageStorePath = ""
const fixturePath = new URL("../../../docs/examples/failed-trace.ndjson", import.meta.url)

let child: ChildProcess | undefined

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) return
    } catch {
      // Server is not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("local server did not become ready")
}

async function postJson(endpoint: string, body: unknown) {
  const response = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

async function run() {
  port = await getFreePort()
  base = `http://127.0.0.1:${port}`
  storePath = path.join(os.tmpdir(), `ad-case-api-test-${port}.ndjson`)
  usageStorePath = `${storePath}.usage.ndjson`
  child = spawn(
    process.execPath,
    ["--import", "tsx", "packages/server/src/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AGENT_DEBUGGER_PORT: String(port),
        AGENT_DEBUGGER_STORE: storePath,
        AGENT_DEBUGGER_TOKEN: "",
      },
      stdio: "ignore",
    },
  )

  await waitForHealth()

  const fixture = await postJson("/api/import", {
    content: readFileSync(fixturePath, "utf8"),
    format: "ndjson",
  })
  assert.equal(fixture.body.imported, 9)

  const second = await postJson("/api/import", {
    traceId: "demo-compare-b",
    events: [
      {
        schemaVersion: 2,
        id: "b-e1",
        traceId: "demo-compare-b",
        type: "tool",
        name: "lookup",
        status: "error",
        input: { apiKey: "sk-should-not-export" },
        output: { success: false, error: "declined" },
        timestamp: 2,
      },
      {
        schemaVersion: 2,
        id: "b-e2",
        traceId: "demo-compare-b",
        type: "reasoning",
        name: "think",
        timestamp: 3,
      },
    ],
  })
  assert.equal(second.body.imported, 2)

  await postJson("/api/usage", {
    source: "openai_api",
    traceId: "demo-failed-checkout",
    payload: {
      id: "chatcmpl-case-a",
      model: "gpt-5.6",
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    },
  })
  await postJson("/api/usage", {
    source: "anthropic_api",
    traceId: "demo-compare-b",
    payload: {
      id: "msg-case-b",
      model: "claude-sonnet-4-5",
      usage: { input_tokens: 20, output_tokens: 5 },
    },
  })

  const packageResponse = await fetch(
    `${base}/api/traces/demo-failed-checkout/package`,
  )
  assert.equal(packageResponse.status, 200)
  const packageText = await packageResponse.text()
  const packageValue = JSON.parse(packageText)
  assert.equal(packageValue.kind, "cause-package")
  assert.equal(packageValue.traceId, "demo-failed-checkout")
  assert.equal(packageValue.integrity.eventCount, 9)
  assert.equal(packageValue.usage.totals.totalTokens, 60)
  assert.ok(packageValue.fingerprint.length === 64)
  assert.ok(packageValue.analysis.observed.some((item: { id: string }) => item.id === "ev-repeated-call"))

  const secondPackageText = await fetch(
    `${base}/api/traces/demo-compare-b/package`,
  ).then((response) => response.text())
  assert.equal(secondPackageText.includes("sk-should-not-export"), false)

  const compare = await fetch(
    `${base}/api/cases/compare?a=demo-failed-checkout&b=demo-compare-b`,
  ).then((response) => response.json())
  assert.equal(compare.kind, "case-comparison")
  assert.equal(compare.a.traceId, "demo-failed-checkout")
  assert.equal(compare.b.traceId, "demo-compare-b")
  assert.equal(compare.metrics.find((item: { key: string }) => item.key === "eventCount")?.delta, -7)
  assert.equal(compare.usage.totals.find((item: { key: string }) => item.key === "totalTokens")?.delta, -35)
  assert.ok(compare.candidates.onlyA.some((item: { id: string }) => item.id === "cand-loop"))
  assert.ok(compare.evidence.onlyA.some((item: { id: string }) => item.id === "ev-repeated-call"))

  const missing = await fetch(`${base}/api/cases/compare?a=unknown&b=demo-compare-b`)
  assert.equal(missing.status, 404)

  const missingParameter = await fetch(`${base}/api/cases/compare?a=demo-compare-b`)
  assert.equal(missingParameter.status, 400)

  console.log("case api tests ok")
}

try {
  await run()
} finally {
  child?.kill()
  rmSync(storePath, { force: true })
  rmSync(usageStorePath, { force: true })
}
