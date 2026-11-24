import assert from "node:assert/strict"
import {
  normalizeAnthropicUsage,
  normalizeClaudeCodeUsage,
  normalizeOpenAIUsage,
  normalizeOtelGenAiUsage,
} from "../../ingest/src/adapters/index.js"
import { buildUsageLedger } from "../src/ledger.js"
import { createEstimatedUsage } from "../src/estimate.js"

function run() {
  const anthropic = normalizeAnthropicUsage({
    id: "msg_1",
    model: "claude-sonnet-4-5",
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 20,
      cache_creation: { input_tokens: 3 },
    },
  })
  assert.ok(anthropic)
  assert.equal(anthropic.source, "anthropic_api")
  assert.equal(anthropic.confidence, "reported")
  assert.equal(anthropic.totalTokens, 38)

  const openai = normalizeOpenAIUsage({
    id: "chatcmpl_1",
    model: "gpt-5.6",
    usage: {
      prompt_tokens: 100,
      completion_tokens: 20,
      prompt_tokens_details: { cached_tokens: 80 },
      completion_tokens_details: { reasoning_tokens: 5 },
    },
  })
  assert.ok(openai)
  const openaiBuckets = openai as {
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    reasoningTokens?: number
    totalTokens?: number
  }
  assert.equal(openaiBuckets.inputTokens, 20)
  assert.equal(openaiBuckets.outputTokens, 15)
  assert.equal(openaiBuckets.cacheReadTokens, 80)
  assert.equal(openaiBuckets.reasoningTokens, 5)
  assert.equal(openaiBuckets.totalTokens, 120)

  const otel = normalizeOtelGenAiUsage({
    "gen_ai.provider.name": "openai",
    "gen_ai.request.model": "gpt-5.6",
    "gen_ai.usage.input_tokens": 7,
    "gen_ai.usage.output_tokens": 3,
  })
  assert.ok(otel)

  const noConsent = normalizeClaudeCodeUsage({
    uuid: "local-1",
    model: "claude-sonnet-4-5",
    usage: { input_tokens: 4, output_tokens: 2 },
  })
  assert.ok(noConsent)
  assert.equal(noConsent.consent, "required")

  const granted = normalizeClaudeCodeUsage(
    {
      uuid: "local-2",
      model: "claude-sonnet-4-5",
      usage: { input_tokens: 4, output_tokens: 2 },
    },
    { consent: "granted" },
  )
  assert.ok(granted)

  const estimate = createEstimatedUsage("x".repeat(40), { id: "estimate-1" })

  const ledger = buildUsageLedger("t-usage", [
    anthropic,
    openai,
    otel,
    noConsent,
    granted,
    estimate,
  ])

  assert.equal(ledger.entries.length, 4)
  assert.equal(ledger.confidence, "reported")
  assert.equal(ledger.totals.entries, 4)
  assert.equal(ledger.totals.inputTokens, 10 + 20 + 7 + 4)
  assert.equal(ledger.totals.outputTokens, 5 + 15 + 3 + 2)
  assert.equal(ledger.totals.cacheReadTokens, 20 + 80)
  assert.equal(ledger.totals.cacheWriteTokens, 3)
  assert.equal(ledger.totals.reasoningTokens, 5)
  assert.equal(
    ledger.totals.totalTokens,
    41 + 25 + 100 + 3 + 5,
  )
  assert.equal(ledger.estimatedExcludedFromCost, true)
  assert.ok(ledger.warnings.some((warning) => warning.includes("consent")))
  assert.ok(ledger.warnings.some((warning) => warning.includes("estimated")))

  const withEstimates = buildUsageLedger("t-usage", [anthropic, estimate], {
    includeEstimates: true,
  })
  assert.equal(withEstimates.entries.length, 2)
  assert.equal(withEstimates.confidence, "estimated")

  console.log("usage ledger tests ok")
}

run()
