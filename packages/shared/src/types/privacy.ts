import type { AiSourceKind } from "./source.js"

export type RedactionProfile = "strict" | "balanced"

export type RedactionDetector =
  | "email"
  | "phone"
  | "api_key"
  | "bearer"
  | "jwt"
  | "credit_card"
  | "ip_address"
  | "hostname"
  | "absolute_path"
  | "customer_id"
  | "person_name"
  | "iban"
  | "aws_key"
  | "depth_limit"
  | "needs_review"

export type RedactionFinding = {
  detector: RedactionDetector
  placeholder: string
  count: number
  needsReview: boolean
}

export type RedactionReceipt = {
  profile: RedactionProfile
  createdAt: number
  rawValuesStored: false
  findings: RedactionFinding[]
  skippedFields: string[]
}

export type ConsentRecord = {
  source: AiSourceKind
  grantedAt: number
  scope: string
  redactionProfile: RedactionProfile
  expiresAt?: number
}

export function emptyReceipt(profile: RedactionProfile): RedactionReceipt {
  return {
    profile,
    createdAt: Date.now(),
    rawValuesStored: false,
    findings: [],
    skippedFields: [],
  }
}
