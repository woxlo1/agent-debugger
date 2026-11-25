import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getFreePort } from "./freePort.ts"

let port = 0
let base = ""
let storePath = ""
let usageStorePath = ""

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

async function postUsage(body: unknown) {
  const response = await fetch(`${base}/api/usage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return response.json()
}

async function run() {
  port = await getFreePort()
  base = `http://127.0.0.1:${port}`
  storePath = path.join(os.tmpdir(), `ad-usage-api-test-${port}.ndjson`)
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

  const normalized = await postUsage({
    source: "openai_api",
    traceId: "t-usage-api",
    payload: {
      id: "chatcmpl-api-1",
      model: "gpt-5.6",
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    },
  })
  assert.equal(normalized.added, 1)

  const entries = await postUsage({
    entries: [
      {
        id: "estimate-api-1",
        traceId: "t-usage-api",
        source: "local_estimate",
        sourceLabel: "Local heuristic estimate",
        confidence: "estimated",
        currency: "USD",
        costSource: "none",
        consent: "not-required",
        warnings: [],
        inputTokens: 999,
        prompt: "must not be stored",
      },
      {
        id: "claude-no-consent",
        traceId: "t-usage-api",
        source: "claude_code_local",
        sourceLabel: "Claude Code local transcript",
        confidence: "reported",
        currency: "USD",
        costSource: "none",
        consent: "required",
        warnings: [],
        inputTokens: 7,
      },
      {
        id: "claude-missing-consent",
        traceId: "t-usage-api",
        source: "claude_code_local",
        sourceLabel: "Claude Code local transcript",
        confidence: "reported",
        currency: "USD",
        costSource: "none",
        warnings: [],
        inputTokens: 11,
      },
    ],
  })
  assert.equal(entries.added, 3)
  assert.equal(entries.rejected, 0)

  const ledger = await fetch(
    `${base}/api/traces/t-usage-api/usage`,
  ).then((response) => response.json())
  assert.equal(ledger.totals.entries, 1)
  assert.equal(ledger.totals.totalTokens, 60)
  assert.equal(ledger.estimatedExcludedFromCost, true)

  const withEstimates = await fetch(
    `${base}/api/traces/t-usage-api/usage?includeEstimates=true`,
  ).then((response) => response.json())
  assert.equal(withEstimates.totals.entries, 2)
  assert.equal(withEstimates.confidence, "estimated")

  const privacy = await fetch(
    `${base}/api/traces/t-usage-api/privacy`,
  ).then((response) => response.json())
  assert.equal(privacy.entries, 4)
  assert.equal(privacy.rawValuesStored, false)
  assert.equal(privacy.consent.required, 2)

  console.log("usage api tests ok")
}

try {
  await run()
} finally {
  child?.kill()
  rmSync(storePath, { force: true })
  rmSync(usageStorePath, { force: true })
}
