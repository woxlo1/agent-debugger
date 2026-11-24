export type UsageConfidence = "reported" | "estimated" | "unknown"

export type AiSourceKind =
  | "anthropic_api"
  | "openai_api"
  | "otel_genai"
  | "openinference"
  | "langchain_callback"
  | "sdk_explicit"
  | "manual_import"
  | "claude_code_local"
  | "claude_web_export"
  | "local_estimate"
  | "unknown"

export type ConsentState = "not-required" | "required" | "granted" | "denied"

export type CostSource = "reported" | "user-rate" | "none"

export const SOURCE_LABELS: Record<AiSourceKind, string> = {
  anthropic_api: "Anthropic API response",
  openai_api: "OpenAI API response",
  otel_genai: "OpenTelemetry GenAI attributes",
  openinference: "OpenInference attributes",
  langchain_callback: "LangChain callback metadata",
  sdk_explicit: "Explicit SDK event",
  manual_import: "Manual import",
  claude_code_local: "Claude Code local transcript",
  claude_web_export: "claude.ai Web export",
  local_estimate: "Local heuristic estimate",
  unknown: "Unknown source",
} as const
