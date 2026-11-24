# Usage Ledger and Privacy Audit

## Data flow

1. The caller supplies a provider response, callback payload, or explicit usage entry. The debugger never calls an AI provider by itself.
2. `packages/ingest` normalizes the payload into the shared `AiUsage` contract.
3. `packages/server/src/usage.ts` rebuilds every entry from an allowlist before persistence. Extra fields such as prompts and API keys are dropped.
4. `packages/usage` builds a ledger. Entries without required consent and local estimates are excluded from billing totals by default.
5. `auditPrivacy()` aggregates redaction receipts into counts and placeholders only.

## API examples

```bash
# Provider response supplied by the caller
curl -X POST http://127.0.0.1:4317/api/usage \
  -H 'content-type: application/json' \
  -d '{"source":"anthropic_api","traceId":"run-1","payload":{"id":"msg_1","model":"claude-sonnet-4-5","usage":{"input_tokens":10,"output_tokens":5}}}'

# Read the ledger
curl 'http://127.0.0.1:4317/api/traces/run-1/usage'

# Include local estimates explicitly
curl 'http://127.0.0.1:4317/api/traces/run-1/usage?includeEstimates=true'

# Read the privacy audit
curl 'http://127.0.0.1:4317/api/traces/run-1/privacy'
```

## Consent rules

| Source | Default consent | Included in totals |
|---|---|---|
| Provider API responses | `not-required` | Yes, when `reported` |
| Explicit SDK events | `not-required` | Yes, when `reported` |
| Claude Code local transcript | `required` | Only after `consent: "granted"` |
| claude.ai Web export | `required` | Only after `consent: "granted"` |
| Local heuristic estimate | `not-required` | Only with `includeEstimates=true` |

## Storage

Usage entries are stored at `${AGENT_DEBUGGER_STORE}.usage.ndjson` by default. Set `AGENT_DEBUGGER_USAGE_STORE` to override the path. The store reloads entries through the same allowlist sanitizer used by the API, so persisted data cannot introduce raw fields.
