import assert from "node:assert/strict"
import { setEndpoint, trace } from "../src/index.ts"

async function run() {
  setEndpoint("http://127.0.0.1:1")
  const originalWarn = console.warn
  console.warn = () => {}

  try {
    const result = await trace({
      type: "tool",
      name: "charge alice@example.com",
      error: "sk-abcdefgh1234",
      source: { path: "C:/Users/alice/project/pay.ts" },
      input: JSON.parse('{"__proto__":{"pwned":true}}'),
    })
    assert.equal(result.ok, false)
    assert.ok(result.event)
    assert.equal(JSON.stringify(result.event).includes("alice@example.com"), false)
    assert.equal(JSON.stringify(result.event).includes("sk-abcdefgh1234"), false)
    assert.equal(result.event.source?.path, "project/pay.ts")
    assert.equal(({} as Record<string, unknown>).pwned, undefined)
    assert.equal(Object.prototype.hasOwnProperty.call({}, "pwned"), false)
  } finally {
    console.warn = originalWarn
  }

  console.log("sdk tests ok")
}

await run()
