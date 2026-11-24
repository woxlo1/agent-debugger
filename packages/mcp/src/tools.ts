import { findCasePackage, compareCaseTraces } from "../../server/src/caseService.js"
import { analyzeTrace } from "../../server/src/analyzer.js"
import { importTrace, type ImportFormat } from "../../server/src/importer.js"
import { store } from "../../server/src/store.js"
import { auditPrivacy, normalizeUsagePayload } from "../../server/src/usage.js"
import { buildUsageLedger } from "../../usage/src/index.js"
import { readClaudeLocalUsage } from "./claudeLocal.js"

export type McpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => unknown
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required string argument: ${key}`)
  }
  return value
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function requireStringArray(args: Record<string, unknown>, key: string): string[] {
  const value = args[key]
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`Missing required string array argument: ${key}`)
  }
  return value as string[]
}

function includeEstimates(args: Record<string, unknown>): boolean {
  return args.includeEstimates === true
}

const traceIdProperty = {
  type: "string",
  description: "Trace id to inspect",
} as const

const includeEstimatesProperty = {
  type: "boolean",
  description: "Include locally estimated usage values (default: false)",
  default: false,
} as const

export const tools: McpTool[] = [
  {
    name: "list_traces",
    description:
      "List locally stored traces with event counts and timestamps. Does not call any external service.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => ({ traces: store.traces() }),
  },
  {
    name: "analyze_trace",
    description:
      "Build the deterministic rule-based Cause Package for one local trace: evidence, candidates with falsifiers, reproduction, handoff, and unknowns.",
    inputSchema: {
      type: "object",
      properties: { traceId: traceIdProperty },
      required: ["traceId"],
      additionalProperties: false,
    },
    handler: (args) => {
      const traceId = requireString(args, "traceId")
      const events = store.list(traceId)
      if (events.length === 0) throw new Error(`Unknown traceId: ${traceId}`)
      return analyzeTrace(traceId, events)
    },
  },
  {
    name: "get_cause_package",
    description:
      "Export a redacted portable Cause Package bundle with integrity fingerprint from the local store.",
    inputSchema: {
      type: "object",
      properties: { traceId: traceIdProperty, includeEstimates: includeEstimatesProperty },
      required: ["traceId"],
      additionalProperties: false,
    },
    handler: (args) => {
      const traceId = requireString(args, "traceId")
      const packageValue = findCasePackage(traceId, includeEstimates(args))
      if (!packageValue) throw new Error(`Unknown traceId: ${traceId}`)
      return packageValue
    },
  },
  {
    name: "compare_traces",
    description:
      "Compare two local traces by metrics, evidence, hypotheses, usage confidence, and redaction findings.",
    inputSchema: {
      type: "object",
      properties: {
        traceIdA: { type: "string", description: "First trace id" },
        traceIdB: { type: "string", description: "Second trace id" },
        includeEstimates: includeEstimatesProperty,
      },
      required: ["traceIdA", "traceIdB"],
      additionalProperties: false,
    },
    handler: (args) => {
      const result = compareCaseTraces(
        requireString(args, "traceIdA"),
        requireString(args, "traceIdB"),
        includeEstimates(args),
      )
      if (!result.ok) throw new Error(`Unknown traceId(s): ${result.missing.join(", ")}`)
      return result.comparison
    },
  },
  {
    name: "get_usage",
    description:
      "Return the consent-aware AI usage ledger for one trace. Estimates are excluded unless explicitly requested.",
    inputSchema: {
      type: "object",
      properties: { traceId: traceIdProperty, includeEstimates: includeEstimatesProperty },
      required: ["traceId"],
      additionalProperties: false,
    },
    handler: (args) => {
      const traceId = requireString(args, "traceId")
      return buildUsageLedger(traceId, store.usages(traceId), {
        includeEstimates: includeEstimates(args),
      })
    },
  },
  {
    name: "get_privacy_audit",
    description:
      "Return count-only redaction receipts, consent states, and confidence counts for one trace.",
    inputSchema: {
      type: "object",
      properties: { traceId: traceIdProperty },
      required: ["traceId"],
      additionalProperties: false,
    },
    handler: (args) => auditPrivacy(store.usages(requireString(args, "traceId"))),
  },
  {
    name: "import_trace",
    description:
      "Import NDJSON/JSON content or normalized events into the local store. Redaction is applied on import.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "NDJSON or JSON trace content" },
        events: { type: "array", items: { type: "object" }, description: "Pre-parsed events" },
        format: { type: "string", enum: ["auto", "ndjson", "json"], default: "auto" },
        traceId: { type: "string", description: "Optional trace id override" },
      },
      additionalProperties: false,
    },
    handler: (args) => {
      const format = optionalString(args, "format") ?? "auto"
      if (format !== "auto" && format !== "ndjson" && format !== "json") {
        throw new Error("format must be auto, ndjson, or json")
      }
      const result = importTrace({
        content: optionalString(args, "content"),
        events: Array.isArray(args.events) ? (args.events as unknown[]) : undefined,
        format: format as ImportFormat,
        traceId: optionalString(args, "traceId"),
      })
      const added = store.addMany(result.events)
      return { ...result, added, storePathExposed: false }
    },
  },
  {
    name: "record_usage",
    description:
      "Normalize and locally store a caller-supplied provider usage payload. Claude local/web sources are intentionally rejected here.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source adapter name, for example openai_api" },
        payload: { type: "object", description: "Caller-supplied provider response" },
        traceId: { type: "string" },
        consent: {
          type: "string",
          enum: ["not-required", "required", "granted", "denied"],
          default: "not-required",
        },
      },
      required: ["source", "payload"],
      additionalProperties: false,
    },
    handler: (args) => {
      const source = requireString(args, "source")
      if (source === "claude_code_local" || source === "claude_web_export") {
        throw new Error(
          "Claude local and web usage require the dedicated consent-aware adapter path",
        )
      }
      const consent = optionalString(args, "consent") ?? "not-required"
      if (consent !== "not-required" && consent !== "required" && consent !== "granted" && consent !== "denied") {
        throw new Error("Invalid consent value")
      }
      const entry = normalizeUsagePayload({
        source,
        payload: args.payload,
        traceId: optionalString(args, "traceId"),
        consent,
      })
      if (!entry) throw new Error(`Unsupported usage source: ${source}`)
      const added = store.addUsage([entry])
      return { added, entry }
    },
  },
  {
    name: "read_claude_local_usage",
    description:
      "Opt-in, path-allowlisted reader for Claude Code JSONL transcript usage. Requires explicit consent and AGENT_DEBUGGER_CLAUDE_LOCAL=enabled. Returns count-only usage and a redaction receipt; never returns transcript text or file paths.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to a local .jsonl transcript export" },
        allowedRoots: {
          type: "array",
          items: { type: "string" },
          description: "Absolute directories this run is allowed to read",
        },
        consentGranted: { type: "boolean", description: "Must be true" },
        acknowledgedScope: { type: "boolean", description: "Must be true" },
        traceId: { type: "string" },
        maxRecords: { type: "number", description: "Maximum records to parse (default 500)" },
      },
      required: ["path", "allowedRoots", "consentGranted", "acknowledgedScope"],
      additionalProperties: false,
    },
    handler: (args) =>
      readClaudeLocalUsage({
        path: requireString(args, "path"),
        allowedRoots: requireStringArray(args, "allowedRoots"),
        consentGranted: args.consentGranted === true,
        acknowledgedScope: args.acknowledgedScope === true,
        traceId: optionalString(args, "traceId"),
        maxRecords: typeof args.maxRecords === "number" ? args.maxRecords : undefined,
      }),
  },
]

export function findTool(name: string): McpTool | undefined {
  return tools.find((tool) => tool.name === name)
}
