import assert from "node:assert/strict"
import { createRedactor } from "../../privacy/src/index.js"
import { auditPrivacy, normalizeUsagePayload, sanitizeUsageEntry } from "../src/usage.js"

function run() {
  const usage = normalizeUsagePayload({
    source: "openai_api",
    payload: {
      id: "chatcmpl-1",
      model: "gpt-5.6",
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    },
    traceId: "t-usage",
  })
  assert.ok(usage)
  assert.equal(usage.source, "openai_api")
  assert.equal(usage.confidence, "reported")
  assert.equal(usage.totalTokens, 120)

  const redactor = createRedactor("strict")
  redactor.redactText("Contact user@example.com with sk-abcdefgh1234")
  const claude = normalizeUsagePayload({
    source: "claude_code_local",
    payload: { uuid: "local-1", usage: { input_tokens: 4, output_tokens: 2 } },
    traceId: "t-usage",
    consent: "granted",
    redaction: redactor.receipt(),
  })
  assert.ok(claude)

  const estimate = normalizeUsagePayload({
    source: "unknown_source",
    payload: {},
  })
  assert.equal(estimate, null)

  const sanitized = sanitizeUsageEntry({
    ...usage,
    prompt: "raw secret should be dropped",
    apiKey: "sk-should-not-persist",
  })!
  assert.equal("prompt" in sanitized, false)
  assert.equal("apiKey" in sanitized, false)

  const claudeBulk = sanitizeUsageEntry({
    id: "claude-bulk-no-consent",
    source: "claude_code_local",
    confidence: "reported",
    inputTokens: 10,
  })
  assert.ok(claudeBulk)
  assert.equal(claudeBulk.consent, "required")
  assert.equal(
    sanitizeUsageEntry({ id: "bogus", source: "not-a-source", confidence: "reported" }),
    null,
  )

  const manual = normalizeUsagePayload({
    source: "manual_import",
    payload: { id: "manual-1", inputTokens: 3, outputTokens: 1 },
  })
  assert.ok(manual)
  assert.equal(manual.source, "manual_import")
  assert.equal(manual.sourceLabel, "Manual import")

  const audit = auditPrivacy([usage, claude])
  assert.equal(audit.entries, 2)
  assert.equal(audit.rawValuesStored, false)
  assert.equal(audit.consent.granted, 1)
  assert.equal(audit.redactionReceipts, 1)
  assert.ok(audit.findings.some((finding) => finding.detector === "email"))
  assert.equal(
    audit.findings.every((finding) => !JSON.stringify(finding).includes("user@example.com")),
    true,
  )

  console.log("server usage helpers tests ok")
}

run()
