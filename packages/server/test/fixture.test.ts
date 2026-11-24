import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { analyzeTrace } from "../src/analyzer.ts"
import { importTrace } from "../src/importer.ts"

const fixturePath = new URL("../../../docs/examples/failed-trace.ndjson", import.meta.url)
const content = readFileSync(fixturePath, "utf8")
const imported = importTrace({ content, format: "ndjson" })
const analysis = analyzeTrace(imported.traceId, imported.events)

function run() {
  assert.equal(imported.imported, 9)
  assert.equal(imported.skipped, 0)
  assert.ok(analysis.observed.some((item) => item.kind === "status_error"))
  assert.ok(analysis.observed.some((item) => item.kind === "error_return"))
  assert.ok(analysis.observed.some((item) => item.kind === "repeated_call"))
  assert.ok(analysis.observed.some((item) => item.kind === "duration_outlier"))
  assert.ok(analysis.observed.some((item) => item.kind === "unfinished_run"))
  assert.ok(
    analysis.handoff.some((item) => item.command.includes("src/payments.ts:88")),
  )
  console.log("fixture tests ok")
}

run()
