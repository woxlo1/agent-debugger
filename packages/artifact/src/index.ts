import { createHash, randomUUID } from "node:crypto"
import type { UsageLedger } from "../../shared/src/index.js"

export const CAUSE_PACKAGE_SCHEMA_VERSION = 1
export const CAUSE_PACKAGE_GENERATOR = "agent-debugger"
export const CAUSE_PACKAGE_GENERATOR_VERSION = "1.0.2"

export type CausePackageEvidence = {
  id: string
  kind: string
  label: string
  detail: string
  eventIds: string[]
}

export type CausePackageCandidate = {
  id: string
  label: string
  confidence: "high" | "medium" | "low"
  evidenceIds: string[]
  falsifier: string
}

export type CausePackageAnalysis = {
  schemaVersion: number
  traceId: string
  generatedAt: number
  basedOn: string
  observed: CausePackageEvidence[]
  candidates: CausePackageCandidate[]
  reproduction: Array<{
    step: number
    instruction: string
    eventId?: string
  }>
  handoff: Array<{
    tool: string
    command: string
    note: string
  }>
  unknowns: string[]
  metrics: {
    eventCount: number
    toolCalls: number
    errorEvents: number
  }
}

export type CausePackageEvent = {
  schemaVersion: number
  id: string
  traceId: string
  parentId?: string
  type: string
  name: string
  status?: string
  error?: { kind?: string; message?: string }
  input?: unknown
  output?: unknown
  timestamp: number
  durationMs?: number
  tokens?: number
  cost?: number
  source?: { path?: string; line?: number; symbol?: string }
  attributes?: Record<string, unknown>
}

export type CausePackagePrivacyAudit = {
  entries: number
  rawValuesStored: false
  consent: Record<"not-required" | "required" | "granted" | "denied", number>
  confidence: Record<"reported" | "estimated" | "unknown", number>
  redactionReceipts: number
  findings: Array<{
    detector: string
    count: number
    needsReview: boolean
  }>
  skippedFields: number
  warnings: string[]
}

export type CausePackageProvenance = {
  generator: string
  generatorVersion: string
  source: "local-store"
  eventSchemaVersion: number
  analysisEngine: string
}

export type CausePackageIntegrity = {
  eventCount: number
  redacted: true
  rawValuesStored: false
  sha256: string
}

type CausePackageBody = {
  schemaVersion: number
  kind: "cause-package"
  packageId: string
  generatedAt: number
  traceId: string
  provenance: CausePackageProvenance
  analysis: CausePackageAnalysis
  usage: UsageLedger
  privacy: CausePackagePrivacyAudit
  events: CausePackageEvent[]
  integrity: CausePackageIntegrity
}

export type CausePackage = CausePackageBody & { fingerprint: string }

export type BuildCausePackageInput = {
  traceId: string
  events: CausePackageEvent[]
  analysis: CausePackageAnalysis
  usage: UsageLedger
  privacy: CausePackagePrivacyAudit
  redactor: (value: unknown) => unknown
  generatedAt?: number
  generatorVersion?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Redact string values while preserving numeric contract fields such as token buckets. */
function redactStrings<T>(value: T, redactor: (value: unknown) => unknown): T {
  if (typeof value === "string") return redactor(value) as T
  if (Array.isArray(value)) {
    return value.map((entry) => redactStrings(entry, redactor)) as T
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactStrings(entry, redactor)]),
    ) as T
  }
  return value
}

function redactEvent(
  event: CausePackageEvent,
  redactor: (value: unknown) => unknown,
): CausePackageEvent {
  const redacted = { ...redactStrings(event, redactor) }
  if ("input" in event) redacted.input = redactor(event.input)
  if ("output" in event) redacted.output = redactor(event.output)
  if (event.attributes) {
    redacted.attributes = redactor(event.attributes) as Record<string, unknown>
  }
  return redacted
}

/** Deterministic JSON serialization so the fingerprint is stable across runtimes. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null) ?? "null"
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

function hashBody(body: CausePackageBody): string {
  const { integrity, ...rest } = body
  const { sha256: _sha256, ...integrityWithoutHash } = integrity
  return createHash("sha256")
    .update(stableStringify({ ...rest, integrity: integrityWithoutHash }))
    .digest("hex")
}

/**
 * Build a portable, redacted handoff artifact. The caller supplies the redactor
 * so the same privacy engine used by ingest and export is applied here.
 */
export function buildCausePackage(input: BuildCausePackageInput): CausePackage {
  if (input.analysis.traceId !== input.traceId) {
    throw new Error("Cause Package analysis traceId does not match the requested trace")
  }
  if (input.usage.traceId !== input.traceId) {
    throw new Error("Cause Package usage traceId does not match the requested trace")
  }
  if (input.privacy.rawValuesStored !== false) {
    throw new Error("Cause Package rejected a privacy audit that stores raw values")
  }

  const events = input.events.map((event) => redactEvent(event, input.redactor))
  const body: CausePackageBody = {
    schemaVersion: CAUSE_PACKAGE_SCHEMA_VERSION,
    kind: "cause-package",
    packageId: randomUUID(),
    generatedAt: input.generatedAt ?? Date.now(),
    traceId: input.traceId,
    provenance: {
      generator: CAUSE_PACKAGE_GENERATOR,
      generatorVersion: input.generatorVersion ?? CAUSE_PACKAGE_GENERATOR_VERSION,
      source: "local-store",
      eventSchemaVersion: events[0]?.schemaVersion ?? 0,
      analysisEngine: input.analysis.basedOn,
    },
    analysis: redactStrings(input.analysis, input.redactor),
    usage: redactStrings(input.usage, input.redactor),
    privacy: redactStrings(input.privacy, input.redactor),
    events,
    integrity: {
      eventCount: events.length,
      redacted: true,
      rawValuesStored: false,
      sha256: "",
    },
  }

  const fingerprint = hashBody(body)
  body.integrity.sha256 = fingerprint
  return { ...body, fingerprint }
}

/** Verify that a package body has not changed since it was built. */
export function verifyCausePackage(packageValue: CausePackage): boolean {
  if (packageValue.kind !== "cause-package") return false
  if (packageValue.schemaVersion !== CAUSE_PACKAGE_SCHEMA_VERSION) return false
  if (packageValue.integrity.redacted !== true) return false
  if (packageValue.integrity.rawValuesStored !== false) return false
  if (packageValue.privacy.rawValuesStored !== false) return false
  if (packageValue.integrity.sha256 !== packageValue.fingerprint) return false
  const { fingerprint, ...body } = packageValue
  return hashBody(body as CausePackageBody) === fingerprint
}
