import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

process.env.AGENT_DEBUGGER_URL = "http://127.0.0.1:1"

const { runPipe } = await import("../bin/pipe.js")

const dir = mkdtempSync(path.join(os.tmpdir(), "ad-pipe-test-"))
const file = path.join(dir, "events.ndjson")
writeFileSync(file, `${JSON.stringify({ type: "tool", name: "offline" })}\n`, "utf8")

const originalLog = console.log
const originalWarn = console.warn
console.log = () => {}
console.warn = () => {}

try {
  const failed = await runPipe(file)
  assert.equal(failed, 1)
} finally {
  console.log = originalLog
  console.warn = originalWarn
  rmSync(dir, { force: true, recursive: true })
}

console.log("pipe exit-code tests ok")
