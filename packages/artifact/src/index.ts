import { createHash, randomUUID } from "node:crypto"
import type { UsageLedger } from "../../shared/src/index.js"

export const CAUSE_PACKAGE_SCHEMA_VERSION = 1
export const CAUSE_PACKAGE_GENERATOR = "agent-debugger"
export const CAUSE_PACKAGE_GENERATOR_VERSION = "0.3.0-alpha.0"

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

  const events = input.events.map(
    (event) => input.redactor(event) as CausePackageEvent,
  )
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
    analysis: input.analysis,
    usage: input.usage,
    privacy: input.privacy,
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
  const { fingerprint, ...body } = packageValue
  return hashBody(body as CausePackageBody) === fingerprint
}
