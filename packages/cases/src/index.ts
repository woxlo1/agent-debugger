import type {
  CausePackage,
  CausePackageCandidate,
  CausePackageEvidence,
} from "../../artifact/src/index.js"
import type { UsageConfidence } from "../../shared/src/index.js"

export const CASE_COMPARISON_SCHEMA_VERSION = 1

export type NumericDiff = {
  key: string
  a: number
  b: number
  delta: number
  changed: boolean
}

export type StringSetDiff = {
  onlyA: string[]
  onlyB: string[]
  shared: string[]
}

export type EntityState = "same" | "changed"

export type EvidenceComparison = {
  id: string
  state: EntityState
  changedFields: string[]
  a: CausePackageEvidence
  b: CausePackageEvidence
}

export type CandidateComparison = {
  id: string
  state: EntityState
  changedFields: string[]
  a: CausePackageCandidate
  b: CausePackageCandidate
}

export type CaseSummary = {
  traceId: string
  packageId: string
  generatedAt: number
  fingerprint: string
  analysisEngine: string
  eventSchemaVersion: number
  confidence: UsageConfidence
  eventCount: number
}

export type CaseComparison = {
  schemaVersion: number
  kind: "case-comparison"
  a: CaseSummary
  b: CaseSummary
  metrics: NumericDiff[]
  evidence: {
    onlyA: CausePackageEvidence[]
    onlyB: CausePackageEvidence[]
    shared: EvidenceComparison[]
  }
  candidates: {
    onlyA: CausePackageCandidate[]
    onlyB: CausePackageCandidate[]
    shared: CandidateComparison[]
  }
  unknowns: StringSetDiff
  usage: {
    totals: NumericDiff[]
    confidence: {
      a: UsageConfidence
      b: UsageConfidence
      changed: boolean
    }
    estimatedExcludedFromCost: {
      a: boolean
      b: boolean
      changed: boolean
    }
    warnings: StringSetDiff
  }
  privacy: {
    rawValuesStored: false
    fields: NumericDiff[]
    consent: NumericDiff[]
    confidence: NumericDiff[]
    findings: NumericDiff[]
    warnings: StringSetDiff
  }
  notes: string[]
}

function valueOf(input: unknown): number {
  return typeof input === "number" && Number.isFinite(input) ? input : 0
}

function numericDiff(
  key: string,
  aValue: unknown,
  bValue: unknown,
): NumericDiff {
  const a = valueOf(aValue)
  const b = valueOf(bValue)
  return { key, a, b, delta: b - a, changed: a !== b }
}

function diffRecord(
  keys: readonly string[],
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): NumericDiff[] {
  return keys.map((key) => numericDiff(key, a[key], b[key]))
}

function serialize(value: unknown): string {
  return JSON.stringify(value ?? null) ?? "null"
}

function changedFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: readonly string[],
): string[] {
  return fields.filter((field) => serialize(a[field]) !== serialize(b[field]))
}

function stringSetDiff(a: string[], b: string[]): StringSetDiff {
  const aSet = new Set(a)
  const bSet = new Set(b)
  return {
    onlyA: a.filter((value) => !bSet.has(value)),
    onlyB: b.filter((value) => !aSet.has(value)),
    shared: a.filter((value) => bSet.has(value)),
  }
}

function mapBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

function findDiff(diffs: NumericDiff[], key: string): NumericDiff {
  return diffs.find((item) => item.key === key) ?? numericDiff(key, 0, 0)
}

function describeDelta(label: string, delta: number): string | null {
  if (delta === 0) return null
  const direction = delta > 0 ? "more" : "fewer"
  return `Case B has ${Math.abs(delta)} ${label}${Math.abs(delta) === 1 ? "" : "s"} ${direction} than case A.`
}

function summarize(packageValue: CausePackage): CaseSummary {
  return {
    traceId: packageValue.traceId,
    packageId: packageValue.packageId,
    generatedAt: packageValue.generatedAt,
    fingerprint: packageValue.fingerprint,
    analysisEngine: packageValue.provenance.analysisEngine,
    eventSchemaVersion: packageValue.provenance.eventSchemaVersion,
    confidence: packageValue.usage.confidence,
    eventCount: packageValue.analysis.metrics.eventCount,
  }
}

/** Compare two portable Cause Packages without calling any external service. */
export function compareCases(a: CausePackage, b: CausePackage): CaseComparison {
  if (a.kind !== "cause-package" || b.kind !== "cause-package") {
    throw new Error("Both inputs must be portable Cause Packages")
  }

  const metrics = diffRecord(
    ["eventCount", "toolCalls", "errorEvents"],
    a.analysis.metrics as unknown as Record<string, unknown>,
    b.analysis.metrics as unknown as Record<string, unknown>,
  )

  const evidenceA = mapBy(a.analysis.observed)
  const evidenceB = mapBy(b.analysis.observed)
  const evidence = {
    onlyA: a.analysis.observed.filter((item) => !evidenceB.has(item.id)),
    onlyB: b.analysis.observed.filter((item) => !evidenceA.has(item.id)),
    shared: a.analysis.observed
      .filter((item) => evidenceB.has(item.id))
      .map((aItem) => {
        const bItem = evidenceB.get(aItem.id)!
        const fields = changedFields(
          aItem as unknown as Record<string, unknown>,
          bItem as unknown as Record<string, unknown>,
          ["kind", "label", "detail", "eventIds"],
        )
        return {
          id: aItem.id,
          state: fields.length > 0 ? ("changed" as const) : ("same" as const),
          changedFields: fields,
          a: aItem,
          b: bItem,
        }
      }),
  }

  const candidateA = mapBy(a.analysis.candidates)
  const candidateB = mapBy(b.analysis.candidates)
  const candidates = {
    onlyA: a.analysis.candidates.filter((item) => !candidateB.has(item.id)),
    onlyB: b.analysis.candidates.filter((item) => !candidateA.has(item.id)),
    shared: a.analysis.candidates
      .filter((item) => candidateB.has(item.id))
      .map((aItem) => {
        const bItem = candidateB.get(aItem.id)!
        const fields = changedFields(
          aItem as unknown as Record<string, unknown>,
          bItem as unknown as Record<string, unknown>,
          ["label", "confidence", "evidenceIds", "falsifier"],
        )
        return {
          id: aItem.id,
          state: fields.length > 0 ? ("changed" as const) : ("same" as const),
          changedFields: fields,
          a: aItem,
          b: bItem,
        }
      }),
  }

  const usageTotals = diffRecord(
    [
      "entries",
      "inputTokens",
      "outputTokens",
      "cacheReadTokens",
      "cacheWriteTokens",
      "reasoningTokens",
      "audioTokens",
      "totalTokens",
      "cost",
    ],
    a.usage.totals as unknown as Record<string, unknown>,
    b.usage.totals as unknown as Record<string, unknown>,
  )

  const findings = diffRecord(
    [
      ...new Set(
        [
          ...a.privacy.findings.map((item) => `${item.detector}:${item.needsReview}`),
          ...b.privacy.findings.map((item) => `${item.detector}:${item.needsReview}`),
        ],
      ),
    ].sort(),
    Object.fromEntries(
      a.privacy.findings.map((item) => [
        `${item.detector}:${item.needsReview}`,
        item.count,
      ]),
    ),
    Object.fromEntries(
      b.privacy.findings.map((item) => [
        `${item.detector}:${item.needsReview}`,
        item.count,
      ]),
    ),
  )

  const privacy = {
    rawValuesStored: false as const,
    fields: diffRecord(
      ["entries", "redactionReceipts", "skippedFields"],
      a.privacy as unknown as Record<string, unknown>,
      b.privacy as unknown as Record<string, unknown>,
    ),
    consent: diffRecord(
      ["not-required", "required", "granted", "denied"],
      a.privacy.consent as unknown as Record<string, unknown>,
      b.privacy.consent as unknown as Record<string, unknown>,
    ),
    confidence: diffRecord(
      ["reported", "estimated", "unknown"],
      a.privacy.confidence as unknown as Record<string, unknown>,
      b.privacy.confidence as unknown as Record<string, unknown>,
    ),
    findings,
    warnings: stringSetDiff(a.privacy.warnings, b.privacy.warnings),
  }

  const notes: string[] = []
  for (const note of [
    describeDelta("error signal", findDiff(metrics, "errorEvents").delta),
    describeDelta("tool call", findDiff(metrics, "toolCalls").delta),
    describeDelta("usage token", findDiff(usageTotals, "totalTokens").delta),
  ]) {
    if (note) notes.push(note)
  }
  if (a.usage.confidence !== b.usage.confidence) {
    notes.push(
      `Usage confidence changed from ${a.usage.confidence} to ${b.usage.confidence}.`,
    )
  }
  if (candidates.onlyA.length > 0 || candidates.onlyB.length > 0) {
    notes.push(
      `Cause hypotheses differ: ${candidates.onlyA.length} unique to A, ${candidates.onlyB.length} unique to B.`,
    )
  }
  if (findDiff(privacy.findings, "api_key:false").changed) {
    notes.push("Redaction findings for api_key differ between the cases.")
  }
  if (notes.length === 0) {
    notes.push("No material differences found between the two cases.")
  }

  return {
    schemaVersion: CASE_COMPARISON_SCHEMA_VERSION,
    kind: "case-comparison",
    a: summarize(a),
    b: summarize(b),
    metrics,
    evidence,
    candidates,
    unknowns: stringSetDiff(a.analysis.unknowns, b.analysis.unknowns),
    usage: {
      totals: usageTotals,
      confidence: {
        a: a.usage.confidence,
        b: b.usage.confidence,
        changed: a.usage.confidence !== b.usage.confidence,
      },
      estimatedExcludedFromCost: {
        a: a.usage.estimatedExcludedFromCost,
        b: b.usage.estimatedExcludedFromCost,
        changed:
          a.usage.estimatedExcludedFromCost !== b.usage.estimatedExcludedFromCost,
      },
      warnings: stringSetDiff(a.usage.warnings, b.usage.warnings),
    },
    privacy,
    notes,
  }
}
