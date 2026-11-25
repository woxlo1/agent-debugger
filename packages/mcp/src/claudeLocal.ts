import fs from "node:fs"
import path from "node:path"
import { normalizeClaudeCodeUsage } from "../../ingest/src/adapters/index.js"
import { createRedactor } from "../../privacy/src/index.js"
import type { AiUsage, RedactionReceipt } from "../../shared/src/index.js"

export const CLAUDE_LOCAL_OPT_IN_ENV = "AGENT_DEBUGGER_CLAUDE_LOCAL"
export const CLAUDE_LOCAL_MAX_BYTES = 10 * 1024 * 1024

export type ReadClaudeLocalUsageInput = {
  /** Absolute path to a local Claude Code JSONL transcript export. */
  path: string
  /** Absolute directories the caller explicitly allows this run to read. */
  allowedRoots: string[]
  /** Must be true. There is no default consent. */
  consentGranted: boolean
  /** Must be true. Confirms the caller understands the scope. */
  acknowledgedScope: boolean
  /** Optional trace id to attach to every normalized entry. */
  traceId?: string
  /** Hard cap on parsed records. Default: 500. */
  maxRecords?: number
}

export type ClaudeLocalUsageResult = {
  source: "claude_code_local"
  entries: AiUsage[]
  redactionReceipt: RedactionReceipt
  recordsRead: number
  recordsWithUsage: number
  skippedRecords: number
  warnings: string[]
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function requireOptIn(): void {
  if (process.env[CLAUDE_LOCAL_OPT_IN_ENV] !== "enabled") {
    throw new Error(
      `Claude local reading is disabled. Set ${CLAUDE_LOCAL_OPT_IN_ENV}=enabled for this local process.`,
    )
  }
}

/**
 * Read usage from a local Claude Code JSONL transcript without persisting or
 * returning transcript text. This is opt-in, path-allowlisted, and count-only.
 *
 * No credentials, browser automation, scraping, or network access is used.
 */
export function readClaudeLocalUsage(
  input: ReadClaudeLocalUsageInput,
): ClaudeLocalUsageResult {
  requireOptIn()

  if (input.consentGranted !== true || input.acknowledgedScope !== true) {
    throw new Error(
      "Explicit consentGranted and acknowledgedScope are required for Claude local usage",
    )
  }
  if (!Array.isArray(input.allowedRoots) || input.allowedRoots.length === 0) {
    throw new Error("At least one absolute allowedRoots entry is required")
  }
  if (!path.isAbsolute(input.path)) {
    throw new Error("The requested path must be an absolute path")
  }
  if (!input.path.endsWith(".jsonl")) {
    throw new Error("Only local .jsonl transcript exports can be read")
  }

  // Containment is checked on both the supplied path and its real path. The
  // second check closes a symlink escape where a .jsonl link inside an allowed
  // root points to a transcript outside it.
  const target = path.resolve(input.path)
  if (!fs.existsSync(target)) {
    throw new Error("The requested transcript path does not exist")
  }

  const roots: string[] = []
  for (const root of input.allowedRoots) {
    if (!path.isAbsolute(root)) {
      throw new Error("allowedRoots entries must be absolute paths")
    }
    const resolvedRoot = path.resolve(root)
    if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
      throw new Error("allowedRoots entries must be existing directories")
    }
    roots.push(fs.realpathSync(resolvedRoot))
  }

  const realTarget = fs.realpathSync(target)
  if (!realTarget.endsWith(".jsonl")) {
    throw new Error("Only local .jsonl transcript exports can be read")
  }
  if (
    !roots.some((root) => isWithin(root, target) && isWithin(root, realTarget))
  ) {
    throw new Error("The requested path is outside the explicit allowedRoots")
  }

  const stats = fs.statSync(realTarget)
  if (!stats.isFile()) throw new Error("The requested path is not a file")
  if (stats.size > CLAUDE_LOCAL_MAX_BYTES) {
    throw new Error("The requested transcript exceeds the 10 MB local read limit")
  }

  const maxRecords =
    typeof input.maxRecords === "number" && Number.isInteger(input.maxRecords) && input.maxRecords > 0
      ? Math.min(input.maxRecords, 5000)
      : 500

  const redactor = createRedactor("strict")
  const content = fs.readFileSync(realTarget, "utf8")
  const entries: AiUsage[] = []
  let recordsRead = 0
  let recordsWithUsage = 0
  let skippedRecords = 0

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (recordsRead >= maxRecords) {
      skippedRecords += 1
      continue
    }
    recordsRead += 1

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      skippedRecords += 1
      continue
    }

    // Redaction happens before normalization. Only allowlisted numeric usage
    // fields and model/request identifiers reach the ledger.
    const redacted = redactor.redact(parsed)
    const usage = normalizeClaudeCodeUsage(redacted, {
      traceId: input.traceId,
      consent: "granted",
    })
    if (!usage) {
      skippedRecords += 1
      continue
    }
    recordsWithUsage += 1
    entries.push(usage)
  }

  const redactionReceipt = redactor.receipt()
  const sanitized = entries.map((entry) => ({ ...entry, redaction: redactionReceipt }))

  return {
    source: "claude_code_local",
    entries: sanitized,
    redactionReceipt,
    recordsRead,
    recordsWithUsage,
    skippedRecords,
    warnings: [
      "Transcript text was redacted before token fields were read",
      "No transcript text, file path, or raw payload is returned by this adapter",
    ],
  }
}
