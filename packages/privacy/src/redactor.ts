import {
  emptyReceipt,
  type RedactionDetector,
  type RedactionFinding,
  type RedactionProfile,
  type RedactionReceipt,
} from "../../shared/src/index.js"

type DetectorRule = {
  detector: RedactionDetector
  pattern: RegExp
  strictOnly?: boolean
  needsReview?: boolean
}

const DETECTORS: DetectorRule[] = [
  {
    detector: "api_key",
    pattern: /(?:sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g,
  },
  { detector: "aws_key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { detector: "jwt", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { detector: "bearer", pattern: /\bBearer\s+[A-Za-z0-9._-]{8,}/gi },
  { detector: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  {
    detector: "phone",
    pattern: /\+?\d{1,3}[-. ]?\(?\d{2,4}\)?[-. ]?\d{3,4}[-. ]?\d{4}\b/g,
  },
  {
    detector: "credit_card",
    pattern: /\b(?:\d[ -]?){12,18}\d\b/g,
  },
  { detector: "ip_address", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  {
    detector: "hostname",
    pattern: /\b(?:[a-z0-9-]+\.)+(?:internal|local|corp|example|test|invalid)\b/gi,
    strictOnly: true,
  },
  {
    detector: "absolute_path",
    pattern: /(?:[A-Za-z]:\\|[\\/]{2})[^\\/\s"']+(?:[\\/][^\\/\s"']+)*|\/(?:Users|home|srv|var|opt)\/[^\s"']+/g,
    strictOnly: true,
  },
  {
    detector: "customer_id",
    pattern: /\b(?:CUST|USER|CUSTOMER)[-_]?[0-9A-Z]{4,}\b/gi,
    strictOnly: true,
  },
  {
    detector: "person_name",
    pattern: /\b(?:Mr|Ms|Mrs|Dr)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
    strictOnly: true,
    needsReview: true,
  },
]

const SECRET_KEY =
  /(?:api[-_]?key|secret|password|passwd|authorization|cookie|credential|private[-_]?key|access[-_]?token|refresh[-_]?token|auth[-_]?token|api[-_]?token|bearer)/i
const PERSONAL_KEY =
  /(?:customer[-_]?id|user[-_]?id|customer[-_]?name|user[-_]?name|full[-_]?name|person[-_]?name|email|phone|ssn|dob|national[-_]?id)/i

const KEY_DETECTORS: Array<{ pattern: RegExp; detector: RedactionDetector; needsReview?: boolean }> = [
  { pattern: /(?:customer|user)[-_]?id/i, detector: "customer_id" },
  { pattern: /email/i, detector: "email" },
  { pattern: /phone/i, detector: "phone" },
  { pattern: /(?:customer|user|full|person)[-_]?name|ssn|dob|national[-_]?id/i, detector: "person_name", needsReview: true },
]

export type Redactor = {
  profile: RedactionProfile
  redact: (value: unknown) => unknown
  redactText: (text: string) => string
  receipt: () => RedactionReceipt
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Creates a stateful redactor. Placeholders are stable within one redactor
 * instance, so correlations can be inspected without keeping raw values.
 */
export function createRedactor(profile: RedactionProfile = "strict"): Redactor {
  const counters = new Map<RedactionDetector, number>()
  const findings = new Map<string, RedactionFinding>()
  const receiptBase = emptyReceipt(profile)

  function nextPlaceholder(detector: RedactionDetector): string {
    const next = (counters.get(detector) ?? 0) + 1
    counters.set(detector, next)
    return `[${detector.toUpperCase()}_${next}]`
  }

  function record(detector: RedactionDetector, needsReview = false): void {
    const key = `${detector}:${needsReview ? "review" : "clean"}`
    const current = findings.get(key)
    if (current) {
      current.count += 1
      return
    }
    findings.set(key, {
      detector,
      placeholder: `[${detector.toUpperCase()}_n]`,
      count: 1,
      needsReview,
    })
  }

  function redactText(text: string): string {
    let result = text
    for (const rule of DETECTORS) {
      if (rule.strictOnly && profile !== "strict") continue
      result = result.replace(rule.pattern, () => {
        record(rule.detector, rule.needsReview === true)
        return nextPlaceholder(rule.detector)
      })
    }
    return result
  }

  function redact(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return value
    if (depth > 8) {
      record("depth_limit")
      return "[REDACTED_DEPTH]"
    }

    if (typeof value === "string") return redactText(value)

    if (Array.isArray(value)) {
      return value.map((entry) => redact(entry, depth + 1))
    }

    if (isRecord(value)) {
      const output: Record<string, unknown> = {}
      for (const [key, entry] of Object.entries(value)) {
        if (SECRET_KEY.test(key)) {
          record("api_key")
          output[key] = "[REDACTED]"
          receiptBase.skippedFields.push(key)
          continue
        }

        if (PERSONAL_KEY.test(key)) {
          const match = KEY_DETECTORS.find((candidate) => candidate.pattern.test(key))
          const detector = match?.detector ?? "person_name"
          record(detector, match?.needsReview === true || profile === "strict")
          output[key] = nextPlaceholder(detector)
          receiptBase.skippedFields.push(key)
          continue
        }

        output[key] = redact(entry, depth + 1)
      }
      return output
    }

    return value
  }

  function receipt(): RedactionReceipt {
    return {
      ...receiptBase,
      createdAt: receiptBase.createdAt,
      rawValuesStored: false,
      findings: [...findings.values()],
      skippedFields: [...receiptBase.skippedFields],
    }
  }

  return { profile, redact, redactText, receipt }
}
