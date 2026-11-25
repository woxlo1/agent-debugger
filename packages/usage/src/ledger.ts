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

type TotalParts = {
  explicit: number | undefined
  fromBuckets: number
}

function addDefined(target: UsageBuckets, entry: AiUsage, totals: TotalParts): void {
  const bucketKeys = BUCKET_KEYS.filter((key) => key !== "totalTokens")
  const bucketValues = bucketKeys.map((key) => entry[key])
  const hasBuckets = bucketValues.some((value) => value !== undefined)

  for (const key of bucketKeys) {
    const value = entry[key]
    if (value !== undefined) {
      target[key] = (target[key] ?? 0) + value
    }
  }

  if (entry.totalTokens !== undefined) {
    totals.explicit = (totals.explicit ?? 0) + entry.totalTokens
  } else if (hasBuckets) {
    totals.fromBuckets += bucketValues.reduce<number>(
      (sum, value) => sum + (value ?? 0),
      0,
    )
  }
}

function finalizeTotal(buckets: UsageBuckets, totals: TotalParts): void {
  const bucketKeys = BUCKET_KEYS.filter((key) => key !== "totalTokens")
  const hasBuckets = bucketKeys.some((key) => buckets[key] !== undefined)
  if (totals.explicit !== undefined) {
    buckets.totalTokens = totals.explicit + totals.fromBuckets
  } else if (hasBuckets) {
    buckets.totalTokens = bucketKeys.reduce<number>(
      (sum, key) => sum + (buckets[key] ?? 0),
      0,
    )
  }
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
  const totalParts: TotalParts = { explicit: undefined, fromBuckets: 0 }
  let cost: number | undefined
  for (const entry of included) {
    addDefined(buckets, entry, totalParts)
    if (entry.cost !== undefined) cost = (cost ?? 0) + entry.cost
  }

  finalizeTotal(buckets, totalParts)
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
