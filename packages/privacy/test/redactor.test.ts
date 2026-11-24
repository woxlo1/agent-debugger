import assert from "node:assert/strict"
import { createRedactor } from "../src/index.js"

function run() {
  const redactor = createRedactor("strict")

  const text = redactor.redactText(
    "Contact Ada@example.com or +81-90-1234-5678. Key sk-abcdefgh1234. Host api.internal.example.com.",
  )
  assert.match(text, /\[EMAIL_1\]/)
  assert.match(text, /\[PHONE_1\]/)
  assert.match(text, /\[API_KEY_1\]/)
  assert.match(text, /\[HOSTNAME_1\]/)
  assert.equal(text.includes("Ada@example.com"), false)
  assert.equal(text.includes("sk-abcdefgh1234"), false)

  const record = redactor.redact({
    apiKey: "sk-abcdefgh1234",
    customerId: "CUST-1234",
    note: "Bearer abcdefgh1234",
    tokens: 42,
  }) as Record<string, unknown>

  assert.equal(record.apiKey, "[REDACTED]")
  assert.equal(record.customerId, "[CUSTOMER_ID_1]")
  assert.match(String(record.note), /\[BEARER_1\]/)
  assert.equal(record.tokens, 42)

  const receipt = redactor.receipt()
  assert.equal(receipt.rawValuesStored, false)
  assert.ok(receipt.findings.some((finding) => finding.detector === "email"))
  assert.ok(receipt.findings.some((finding) => finding.detector === "api_key"))
  assert.equal(
    receipt.findings.every((finding) => !JSON.stringify(finding).includes("Ada@example.com")),
    true,
  )

  const balanced = createRedactor("balanced").redactText("api.internal.example.com")
  assert.equal(balanced, "api.internal.example.com")

  console.log("privacy redactor tests ok")
}

run()
