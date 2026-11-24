import type {
  AiUsage,
  UsageBuckets,
  UsageConfidence,
  UsageLedger,
  UsageTotals,
} from "../../shared/src/index.js"

const BUCKET_KEYS: Array<keyof UsageBuckets> = [
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "reasoningTokens",
  "audioTokens",
  "totalTokens",
]

function addDefined(target: UsageBuckets, entry: AiUsage): void {
  const bucketValues = BUCKET_KEYS.filter((key) => key !== "totalTokens").map(
    (key) => entry[key],
  )
  const hasBuckets = bucketValues.some((value) => value !== undefined)
  const total = hasBuckets
    ? bucketValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : entry.totalTokens

  if (hasBuckets) {
    for (const key of BUCKET_KEYS) {
      if (key === "totalTokens") continue
      const value = entry[key]
      if (value !== undefined) {
        target[key] = (target[key] ?? 0) + value
      }
    }
  } else if (total !== undefined) {
    target.totalTokens = (target.totalTokens ?? 0) + total
  }
}

function finalizeTotal(buckets: UsageBuckets): void {
  const bucketTotal = BUCKET_KEYS.filter((key) => key !== "totalTokens").reduce<number>(
    (sum, key) => sum + (buckets[key] ?? 0),
    0,
  )
  const hasBuckets = BUCKET_KEYS.filter((key) => key !== "totalTokens").some(
    (key) => buckets[key] !== undefined,
  )
  if (hasBuckets) buckets.totalTokens = bucketTotal
}

function aggregateConfidence(entries: AiUsage[]): UsageConfidence {
  if (entries.length === 0) return "unknown"
  if (entries.some((entry) => entry.confidence === "unknown")) return "unknown"
  if (entries.some((entry) => entry.confidence === "estimated")) return "estimated"
  return "reported"
}

export function buildUsageLedger(
  traceId: string,
  entries: AiUsage[],
  options: { includeEstimates?: boolean } = {},
): UsageLedger {
  const warnings: string[] = []
  let excludedConsent = 0
  let excludedEstimate = 0

  const included = entries.filter((entry) => {
    if (entry.consent === "denied" || entry.consent === "required") {
      excludedConsent += 1
      return false
    }
    if (entry.confidence === "estimated" && options.includeEstimates !== true) {
      excludedEstimate += 1
      return false
    }
    return true
  })

  if (excludedConsent > 0) {
    warnings.push(`${excludedConsent} usage entries excluded because consent is not granted`)
  }
  if (excludedEstimate > 0) {
    warnings.push(`${excludedEstimate} estimated entries excluded from billing totals`)
  }

  const buckets: UsageBuckets = {}
  let cost: number | undefined
  for (const entry of included) {
    addDefined(buckets, entry)
    if (entry.cost !== undefined) cost = (cost ?? 0) + entry.cost
  }

  finalizeTotal(buckets)
  const totals: UsageTotals = { ...buckets, entries: included.length }
  if (cost !== undefined) totals.cost = cost

  return {
    traceId,
    entries: included,
    totals,
    confidence: aggregateConfidence(included),
    warnings,
    estimatedExcludedFromCost: excludedEstimate > 0,
  }
}
