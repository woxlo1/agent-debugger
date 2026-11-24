import assert from "node:assert/strict"
import { createUsage } from "../../shared/src/index.js"
import { createRedactor } from "../../privacy/src/index.js"
import { buildUsageLedger } from "../../usage/src/index.js"
import {
  buildCausePackage,
  verifyCausePackage,
  type CausePackageAnalysis,
  type CausePackagePrivacyAudit,
} from "../src/index.js"

const SECRET = "sk-abcdefgh1234"

function fixture(): {
  analysis: CausePackageAnalysis
  privacy: CausePackagePrivacyAudit
  events: Array<{
    schemaVersion: number
    id: string
    traceId: string
    type: string
    name: string
    timestamp: number
    input: unknown
    output: unknown
  }>
} {
  return {
    events: [
      {
        schemaVersion: 2,
        id: "e1",
        traceId: "t-package",
        type: "tool",
        name: "charge",
        timestamp: 1,
        input: { apiKey: SECRET, amount: 100 },
        output: { ok: false },
      },
      {
        schemaVersion: 2,
        id: "e2",
        traceId: "t-package",
        type: "reasoning",
        name: "plan",
        timestamp: 2,
        input: `Retry with ${SECRET}`,
        output: "no",
      },
    ],
    analysis: {
      schemaVersion: 2,
      traceId: "t-package",
      generatedAt: 1,
      basedOn: "rule-based-v1",
      observed: [
        {
          id: "ev-status-error",
          kind: "status_error",
          label: "Steps marked as errors",
          detail: "1 event(s) carry an explicit error status.",
          eventIds: ["e1"],
        },
      ],
      candidates: [
        {
          id: "cand-error",
          label: "A tool or step reported an error",
          confidence: "medium",
          evidenceIds: ["e1"],
          falsifier: "The same input succeeds directly.",
        },
      ],
      reproduction: [{ step: 1, instruction: "Inspect e1.", eventId: "e1" }],
      handoff: [{ tool: "debugger", command: "break src/payments.ts", note: "local" }],
      unknowns: ["No source location for e2."],
      metrics: { eventCount: 2, toolCalls: 1, errorEvents: 1 },
    },
    privacy: {
      entries: 1,
      rawValuesStored: false,
      consent: {
        "not-required": 1,
        required: 0,
        granted: 0,
        denied: 0,
      },
      confidence: { reported: 1, estimated: 0, unknown: 0 },
      redactionReceipts: 1,
      findings: [{ detector: "api_key", count: 1, needsReview: false }],
      skippedFields: 1,
      warnings: [],
    },
  }
}

function run() {
  const { events, analysis, privacy } = fixture()
  const usage = buildUsageLedger("t-package", [
    createUsage({
      id: "u1",
      source: "openai_api",
      confidence: "reported",
      buckets: { inputTokens: 10, outputTokens: 5 },
    }),
  ])
  const redactor = createRedactor("strict")

  const artifact = buildCausePackage({
    traceId: "t-package",
    events,
    analysis,
    usage,
    privacy,
    redactor: redactor.redact,
    generatedAt: 1_700_000_000_000,
  })

  assert.equal(artifact.kind, "cause-package")
  assert.equal(artifact.schemaVersion, 1)
  assert.equal(artifact.integrity.eventCount, 2)
  assert.equal(artifact.integrity.rawValuesStored, false)
  assert.equal(artifact.privacy.rawValuesStored, false)
  assert.ok(artifact.fingerprint.length === 64)
  assert.equal(JSON.stringify(artifact).includes(SECRET), false)
  assert.equal(verifyCausePackage(artifact), true)
  assert.equal(verifyCausePackage({ ...artifact, traceId: "tampered" }), false)

  assert.throws(
    () =>
      buildCausePackage({
        traceId: "t-package",
        events,
        analysis,
        usage,
        privacy: { ...privacy, rawValuesStored: true as false },
        redactor: redactor.redact,
      }),
    /raw values/,
  )

  console.log("artifact tests ok")
}

run()
