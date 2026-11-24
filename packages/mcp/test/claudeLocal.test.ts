import assert from "node:assert/strict"
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { readClaudeLocalUsage } from "../src/claudeLocal.js"

const SECRET = "sk-abcdefgh1234"
const EMAIL = "user@example.com"

function writeTranscript(dir: string, name = "claude-transcript.jsonl"): string {
  const target = path.join(dir, name)
  const lines = [
    JSON.stringify({
      type: "assistant",
      uuid: "req-local-1",
      model: "claude-sonnet-4-5",
      usage: {
        input_tokens: 120,
        output_tokens: 30,
        cache_read_input_tokens: 10,
      },
      message: { content: `Retry with ${SECRET} and contact ${EMAIL}` },
    }),
    JSON.stringify({ type: "assistant", message: { content: "no usage here" } }),
    "{ invalid json line",
  ]
  writeFileSync(target, `${lines.join("\n")}\n`, "utf8")
  return target
}

async function run() {
  const temp = mkdtempSync(path.join(os.tmpdir(), "ad-claude-local-test-"))
  const other = mkdtempSync(path.join(os.tmpdir(), "ad-claude-local-other-"))
  const previous = process.env.AGENT_DEBUGGER_CLAUDE_LOCAL
  process.env.AGENT_DEBUGGER_CLAUDE_LOCAL = "enabled"

  try {
    const target = writeTranscript(temp)

    const result = readClaudeLocalUsage({
      path: target,
      allowedRoots: [temp],
      consentGranted: true,
      acknowledgedScope: true,
      traceId: "t-claude-local",
    })

    assert.equal(result.source, "claude_code_local")
    assert.equal(result.entries.length, 1)
    assert.equal(result.recordsRead, 3)
    assert.equal(result.recordsWithUsage, 1)
    assert.equal(result.skippedRecords, 2)
    assert.equal(result.entries[0].confidence, "reported")
    assert.equal(result.entries[0].consent, "granted")
    assert.equal(result.entries[0].source, "claude_code_local")
    assert.equal(result.entries[0].traceId, "t-claude-local")
    assert.equal(result.entries[0].redaction?.rawValuesStored, false)
    assert.ok(
      result.redactionReceipt.findings.some((finding) => finding.detector === "api_key"),
    )
    assert.ok(
      result.redactionReceipt.findings.some((finding) => finding.detector === "email"),
    )
    assert.equal(JSON.stringify(result).includes(SECRET), false)
    assert.equal(JSON.stringify(result).includes(EMAIL), false)
    assert.equal(JSON.stringify(result).includes(target), false)

    assert.throws(
      () =>
        readClaudeLocalUsage({
          path: target,
          allowedRoots: [temp],
          consentGranted: false,
          acknowledgedScope: true,
        }),
      /Explicit consent/,
    )

    assert.throws(
      () =>
        readClaudeLocalUsage({
          path: writeTranscript(other, "outside.jsonl"),
          allowedRoots: [temp],
          consentGranted: true,
          acknowledgedScope: true,
        }),
      /outside the explicit allowedRoots/,
    )

    assert.throws(
      () =>
        readClaudeLocalUsage({
          path: target,
          allowedRoots: ["."],
          consentGranted: true,
          acknowledgedScope: true,
        }),
      /must be absolute paths/,
    )

    assert.throws(
      () =>
        readClaudeLocalUsage({
          path: target,
          allowedRoots: [path.join(temp, "missing-root")],
          consentGranted: true,
          acknowledgedScope: true,
        }),
      /must be existing directories/,
    )

    const outsideTarget = writeTranscript(other, "symlink-source.jsonl")
    const linkedTarget = path.join(temp, "linked.jsonl")
    try {
      symlinkSync(outsideTarget, linkedTarget, "file")
      assert.throws(
        () =>
          readClaudeLocalUsage({
            path: linkedTarget,
            allowedRoots: [temp],
            consentGranted: true,
            acknowledgedScope: true,
          }),
        /outside the explicit allowedRoots/,
      )
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined
      if (code !== "EPERM" && code !== "EACCES" && code !== "ENOSYS") throw error
      console.log("claude local symlink containment test skipped (symlinks unavailable)")
    }

    process.env.AGENT_DEBUGGER_CLAUDE_LOCAL = "disabled"
    assert.throws(
      () =>
        readClaudeLocalUsage({
          path: target,
          allowedRoots: [temp],
          consentGranted: true,
          acknowledgedScope: true,
        }),
      /disabled/,
    )

    console.log("claude local adapter tests ok")
  } finally {
    if (previous === undefined) delete process.env.AGENT_DEBUGGER_CLAUDE_LOCAL
    else process.env.AGENT_DEBUGGER_CLAUDE_LOCAL = previous
    rmSync(temp, { force: true, recursive: true })
    rmSync(other, { force: true, recursive: true })
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
