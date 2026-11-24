import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const port = 4300 + Math.floor(Math.random() * 500)
const base = `http://127.0.0.1:${port}`
const storePath = path.join(os.tmpdir(), `ad-api-test-${port}.ndjson`)
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

async function run() {
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

  // lgtm[js/file-access-to-http] The test fixture is intentionally imported
  // into the locally spawned debugger server.
  const content = readFileSync(fixturePath, "utf8")
  const imported = await fetch(`${base}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, format: "ndjson" }),
  }).then((response) => response.json())

  assert.equal(imported.imported, 9)
  assert.equal(imported.added, 9)
  assert.equal(imported.traceId, "demo-failed-checkout")

  const analysis = await fetch(
    `${base}/api/traces/${encodeURIComponent(imported.traceId)}/analysis`,
  ).then((response) => response.json())

  assert.ok(analysis.observed.some((item: { kind: string }) => item.kind === "repeated_call"))
  assert.ok(analysis.candidates.some((item: { id: string }) => item.id === "cand-loop"))

  const exported = await fetch(
    `${base}/api/traces/${encodeURIComponent(imported.traceId)}/export`,
  ).then((response) => response.text())

  assert.equal(exported.trim().split("\n").length, 9)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const stream = await fetch(`${base}/api/stream`, { signal: controller.signal })
    const reader = stream.body.getReader()
    await new Promise((resolve) => setTimeout(resolve, 150))

    await fetch(`${base}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "system", name: "sse_probe", status: "ok" }),
    })

    const chunk = await reader.read()
    const sample = new TextDecoder().decode(chunk.value ?? new Uint8Array())
    assert.ok(sample.includes("data:"))
    await reader.cancel()
  } finally {
    clearTimeout(timer)
  }

  console.log("api tests ok")
}

try {
  await run()
} finally {
  child?.kill()
  rmSync(storePath, { force: true })
}
