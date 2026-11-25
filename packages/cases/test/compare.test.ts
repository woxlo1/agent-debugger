import assert from "node:assert/strict"
import {
  buildCausePackage,
  type CausePackage,
  type CausePackageAnalysis,
  type CausePackagePrivacyAudit,
} from "../../artifact/src/index.js"
import { createUsage } from "../../shared/src/index.js"
import { buildUsageLedger } from "../../usage/src/index.js"
import { compareCases } from "../src/index.js"

function makePackage(traceId: string, variant: "a" | "b"): CausePackage {
  const events = [
    {
      schemaVersion: 2,
      id: `${variant}-e1`,
      traceId,
      type: "tool",
      name: "charge",
      timestamp: 1,
      input: { amount: 100 },
      output: { ok: false },
    },
  ]

  const analysis: CausePackageAnalysis = {
    schemaVersion: 2,
    traceId,
    generatedAt: 1,
    basedOn: "rule-based-v1",
    observed: [
      variant === "a"
        ? {
            id: "ev-repeated-call",
            kind: "repeated_call",
            label: "Identical tool calls repeated",
            detail: "3 calls",
            eventIds: [`${variant}-e1`],
          }
        : {
            id: "ev-status-error",
            kind: "status_error",
            label: "Steps marked as errors",
            detail: "1 event",
            eventIds: [`${variant}-e1`],
          },
    ],
    candidates: [
      variant === "a"
        ? {
            id: "cand-loop",
            label: "The agent looped",
            confidence: "high" as const,
            evidenceIds: ["ev-repeated-call"],
            falsifier: "It reaches a final answer.",
          }
        : {
            id: "cand-error",
            label: "A tool or step reported an error",
            confidence: "low" as const,
            evidenceIds: ["ev-status-error"],
            falsifier: "The same input succeeds directly.",
          },
    ],
    reproduction: [{ step: 1, instruction: "Inspect the tool call." }],
    handoff: [{ tool: "debugger", command: "break src/payments.ts", note: "local" }],
    unknowns: variant === "a" ? ["No source location."] : ["No final answer."],
    metrics: {
      eventCount: variant === "a" ? 5 : 3,
      toolCalls: variant === "a" ? 4 : 2,
      errorEvents: variant === "a" ? 1 : 2,
    },
  }

  const usage = buildUsageLedger(
    traceId,
    [
      createUsage({
        id: `${variant}-u1`,
        source: variant === "a" ? "openai_api" : "anthropic_api",
        confidence: variant === "a" ? "reported" : "estimated",
        buckets:
          variant === "a"
            ? { inputTokens: 80, outputTokens: 20 }
            : { inputTokens: 30, outputTokens: 10 },
      }),
    ],
    { includeEstimates: variant === "b" },
  )

  const privacy: CausePackagePrivacyAudit = {
    entries: 1,
    rawValuesStored: false,
    consent: {
      "not-required": 1,
      required: 0,
      granted: 0,
      denied: 0,
    },
    confidence:
      variant === "a"
        ? { reported: 1, estimated: 0, unknown: 0 }
        : { reported: 0, estimated: 1, unknown: 0 },
    redactionReceipts: 1,
    findings:
      variant === "a"
        ? [{ detector: "api_key", count: 1, needsReview: false }]
        : [],
    skippedFields: variant === "a" ? 1 : 0,
    warnings: [],
  }

  return buildCausePackage({
    traceId,
    events,
    analysis,
    usage,
    privacy,
    redactor: (value) => value,
    generatedAt: 1_700_000_000_000,
  })
}

function run() {
  const a = makePackage("t-compare-a", "a")
  const b = makePackage("t-compare-b", "b")
  const comparison = compareCases(a, b)

  assert.equal(comparison.kind, "case-comparison")
  assert.equal(comparison.a.traceId, "t-compare-a")
  assert.equal(comparison.b.traceId, "t-compare-b")
  assert.equal(comparison.metrics.find((item) => item.key === "eventCount")?.delta, -2)
  assert.equal(comparison.metrics.find((item) => item.key === "errorEvents")?.delta, 1)
  assert.ok(comparison.evidence.onlyA.some((item) => item.id === "ev-repeated-call"))
  assert.ok(comparison.evidence.onlyB.some((item) => item.id === "ev-status-error"))
  assert.ok(comparison.candidates.onlyA.some((item) => item.id === "cand-loop"))
  assert.equal(comparison.candidates.shared.length, 0)
  assert.equal(
    comparison.usage.totals.find((item) => item.key === "totalTokens")?.delta,
    -60,
  )
  assert.equal(comparison.usage.confidence.changed, true)
  assert.equal(comparison.privacy.rawValuesStored, false)
  assert.ok(
    comparison.privacy.findings.some(
      (item) => item.key === "api_key:false" && item.delta === -1,
    ),
  )
  assert.ok(comparison.notes.some((note) => note.includes("Usage confidence changed")))
  assert.ok(
    comparison.notes.some((note) => note.includes("Redaction findings for api_key")),
  )

  const same = compareCases(a, a)
  assert.equal(same.notes[0], "No material differences found between the two cases.")
  assert.equal(same.usage.confidence.changed, false)

  console.log("case comparison tests ok")
}

run()
