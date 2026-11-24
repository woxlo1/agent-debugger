import assert from "node:assert/strict"
import { exportNdjson, importTrace } from "../src/importer.ts"
import { normalizeEvent } from "../src/schema.ts"

function run() {
  const ndjson = [
    JSON.stringify({
      type: "tool",
      name: "search",
      input: {
        apiKey: "sk-abcdefgh1234",
        note: "contact user@example.com",
      },
      output: "ok",
    }),
    "this line is not json",
    JSON.stringify({
      name: "tool_span",
      attributes: {
        "openinference.span.kind": "TOOL",
        "status.code": 2,
        "code.filepath": "src/search.ts",
        "code.lineno": 31,
      },
      start_time_unix_nano: 1_000_000_000,
      end_time_unix_nano: 2_000_000_000,
      error: { message: "timeout" },
    }),
  ].join("\n")

  const result = importTrace({ content: ndjson, format: "ndjson", traceId: "t-import" })
  assert.equal(result.imported, 2)
  assert.equal(result.skipped, 1)
  assert.equal(result.events[0].type, "tool")
  assert.equal(result.events[0].traceId, "t-import")

  const redactedInput = result.events[0].input as Record<string, unknown>
  assert.equal(redactedInput.apiKey, "[REDACTED]")
  assert.equal(redactedInput.note, "contact [REDACTED_EMAIL]")

  const otel = result.events[1]
  assert.equal(otel.type, "tool")
  assert.equal(otel.status, "error")
  assert.equal(otel.source?.path, "src/search.ts")
  assert.equal(otel.source?.line, 31)
  assert.equal(otel.durationMs, 1000)

  const exported = exportNdjson(result.events)
  assert.equal(exported.includes("sk-abcdefgh1234"), false)
  assert.equal(exported.includes("user@example.com"), false)

  const arrayResult = importTrace({
    content: JSON.stringify([{ name: "step_a" }, { name: "step_b" }]),
  })
  assert.equal(arrayResult.imported, 2)

  const wrappedResult = importTrace({ events: [{ name: "wrapped" }] })
  assert.equal(wrappedResult.imported, 1)

  const emptyResult = importTrace({ content: "" })
  assert.equal(emptyResult.imported, 0)
  assert.equal(emptyResult.skipped, 0)

  const isoEvent = normalizeEvent(
    {
      name: "charge alice@example.com",
      error: { message: "sk-abcdefgh1234" },
      timestamp: "2024-01-02T03:04:05Z",
      source: { path: "C:/Users/alice/project/pay.ts" },
    },
    "t-iso",
  )
  assert.ok(isoEvent)
  assert.equal(isoEvent.timestamp, Date.parse("2024-01-02T03:04:05Z"))
  assert.equal(isoEvent.name.includes("alice@example.com"), false)
  assert.equal(isoEvent.error?.message?.includes("sk-abcdefgh1234"), false)
  assert.equal(isoEvent.source?.path, "project/pay.ts")

  const overridden = importTrace({
    events: [{ name: "step", traceId: "original" }],
    traceId: "override",
  })
  assert.equal(overridden.events[0].traceId, "override")

  console.log("importer tests ok")
}

run()
