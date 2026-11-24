import assert from "node:assert/strict"
import { analyzeTrace } from "../src/analyzer.ts"
import { importTrace } from "../src/importer.ts"

function analyze(rawEvents: unknown[]) {
  const imported = importTrace({ events: rawEvents })
  return analyzeTrace("t-analyze", imported.events)
}

function run() {
  const empty = analyze([])
  assert.equal(empty.candidates[0].id, "cand-unknown")
  assert.ok(empty.unknowns.some((item) => item.includes("source location")))

  const repeated = analyze([
    { type: "tool", name: "charge", input: { id: 1 }, output: { ok: true } },
    { type: "tool", name: "charge", input: { id: 1 }, output: { ok: true } },
    { type: "tool", name: "charge", input: { id: 1 }, output: { ok: true } },
  ])
  assert.ok(repeated.observed.some((item) => item.kind === "repeated_call"))
  assert.ok(repeated.candidates.some((item) => item.id === "cand-loop"))
  assert.ok(repeated.reproduction.length >= 2)

  const missing = analyze([
    { type: "tool", name: "lookup" },
    { type: "tool", name: "fetch" },
  ])
  assert.ok(missing.observed.some((item) => item.kind === "missing_result"))
  assert.ok(missing.candidates.some((item) => item.id === "cand-missing"))

  const errorReturn = analyze([
    {
      type: "tool",
      name: "charge",
      output: { success: false, error: "declined" },
      status: "error",
      source: { path: "src/payments.ts", line: 88 },
    },
  ])
  assert.ok(errorReturn.observed.some((item) => item.kind === "error_return"))
  assert.ok(errorReturn.observed.some((item) => item.kind === "status_error"))
  assert.ok(
    errorReturn.handoff.some((item) => item.command.includes("src/payments.ts:88")),
  )

  const slow = analyze([
    { type: "tool", name: "a", durationMs: 100 },
    { type: "tool", name: "b", durationMs: 100 },
    { type: "tool", name: "c", durationMs: 100 },
    { type: "tool", name: "d", durationMs: 1200 },
  ])
  assert.ok(slow.observed.some((item) => item.kind === "duration_outlier"))
  assert.ok(slow.candidates.some((item) => item.id === "cand-slow"))

  const unfinished = analyze([
    { type: "user", name: "ask", output: "question" },
    { type: "reasoning", name: "think" },
  ])
  assert.ok(unfinished.observed.some((item) => item.kind === "unfinished_run"))

  for (const candidate of repeated.candidates) {
    assert.ok(candidate.falsifier.length > 0)
  }

  console.log("analyzer tests ok")
}

run()
