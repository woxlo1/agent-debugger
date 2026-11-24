import { analyzeTrace } from "../src/analyzer.ts"
import { importTrace } from "../src/importer.ts"

const events = [
  {
    type: "tool",
    name: "charge",
    input: { amount: 1 },
    output: { success: false, error: "declined" },
    status: "error",
  },
  {
    type: "tool",
    name: "charge",
    input: { amount: 1 },
    output: { success: false, error: "declined" },
    status: "error",
  },
  {
    type: "tool",
    name: "charge",
    input: { amount: 1 },
    output: { success: false, error: "declined" },
    status: "error",
  },
]

const imported = importTrace({ content: JSON.stringify(events) })
const analysis = analyzeTrace(imported.traceId, imported.events)

if (imported.imported !== 3) throw new Error("expected 3 imported events")
if (imported.skipped !== 0) throw new Error("expected 0 skipped events")
if (!analysis.observed.some((item) => item.kind === "error_return")) {
  throw new Error("expected error_return evidence")
}
if (!analysis.observed.some((item) => item.kind === "repeated_call")) {
  throw new Error("expected repeated_call evidence")
}
if (!analysis.candidates.some((candidate) => candidate.id === "cand-loop")) {
  throw new Error("expected loop candidate")
}

console.log("smoke ok")
