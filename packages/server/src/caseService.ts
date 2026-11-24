import { buildCausePackage, type CausePackage } from "../../artifact/src/index.js"
import {
  compareCases,
  type CaseComparison,
} from "../../cases/src/index.js"
import { buildUsageLedger } from "../../usage/src/index.js"
import { analyzeTrace } from "./analyzer.js"
import { redact } from "./schema.js"
import { store } from "./store.js"
import { auditPrivacy } from "./usage.js"

export type CasePackageResult =
  | { ok: true; package: CausePackage }
  | { ok: false; missing: string[] }

export type CaseCompareResult =
  | { ok: true; comparison: CaseComparison }
  | { ok: false; missing: string[] }

function buildFor(traceId: string, includeEstimates: boolean): CausePackage {
  const events = store.list(traceId)
  const usages = store.usages(traceId)
  return buildCausePackage({
    traceId,
    events,
    analysis: analyzeTrace(traceId, events),
    usage: buildUsageLedger(traceId, usages, { includeEstimates }),
    privacy: auditPrivacy(usages),
    redactor: redact,
  })
}

export function findCasePackage(
  traceId: string,
  includeEstimates = false,
): CausePackage | null {
  if (store.list(traceId).length === 0) return null
  return buildFor(traceId, includeEstimates)
}

export function compareCaseTraces(
  a: string,
  b: string,
  includeEstimates = false,
): CaseCompareResult {
  const missing = [...new Set([a, b].filter((id) => store.list(id).length === 0))]
  if (missing.length > 0) return { ok: false, missing }
  return {
    ok: true,
    comparison: compareCases(
      buildFor(a, includeEstimates),
      buildFor(b, includeEstimates),
    ),
  }
}
