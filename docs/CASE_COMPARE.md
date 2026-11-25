# Case Comparison and Portable Cause Packages

## Purpose

Stage 3 adds two local-only workflows:

1. **Portable Cause Package** — export one failed run as a single redacted JSON artifact.
2. **Case comparison** — diff two local traces to see what changed between a failing and a passing run.

Neither workflow calls an AI service, uploads data, or requires an account.

## Portable Cause Package

### Export

```bash
# CLI: stdout
agent-debugger package <traceId>

# CLI: local file
agent-debugger package <traceId> failed-run.cause.json

# HTTP
curl http://127.0.0.1:4317/api/traces/<traceId>/package > failed-run.cause.json
```

Add `?includeEstimates=true` (CLI: `--include-estimates`) only when local estimates should be included in the usage ledger.

### Bundle contract

`kind` is always `cause-package` and `schemaVersion` is currently `1`.

| Field | Contents |
|---|---|
| `packageId` | Random UUID for this export |
| `generatedAt` | Export timestamp |
| `traceId` | Source trace identifier |
| `provenance` | Generator, generator version, store kind, event schema version, analysis engine |
| `analysis` | Rule-based evidence, candidates, reproduction steps, handoff steps, unknowns, metrics |
| `usage` | Consent-aware ledger with `reported` / `estimated` / `unknown` labels |
| `privacy` | Redaction receipt counts, consent counts, warnings; `rawValuesStored` is always `false` |
| `events` | Redacted v2 events in timestamp order |
| `integrity` | Event count, redaction flag, raw-value flag, SHA-256 checksum |
| `fingerprint` | SHA-256 of the canonical bundle body |

The fingerprint is computed from a stable, key-sorted JSON representation. It detects accidental edits to the body; it is not a signature and does not establish trust in the source file.

### Privacy rules

- Events are passed through the same redactor used by event ingest, SSE output, and NDJSON export.
- Usage entries are already allowlist-sanitized before persistence, so prompts and API keys are not part of a bundle.
- Privacy data contains detector names and counts only.
- The bundle does not contain local filesystem paths or environment values.
- `buildCausePackage()` rejects a privacy audit whose `rawValuesStored` is not `false`.

## Case comparison

```bash
# CLI
agent-debugger compare <traceIdA> <traceIdB>

# HTTP
curl 'http://127.0.0.1:4317/api/cases/compare?a=<traceIdA>&b=<traceIdB>'
```

The web **Compare** tab exposes the same result and links to a package export for case A.

### Comparison sections

| Section | What is diffed |
|---|---|
| `metrics` | Event count, tool calls, error signals |
| `evidence` | Evidence IDs present only in A/B and shared evidence whose fields changed |
| `candidates` | Cause hypotheses unique to A/B and shared hypotheses with changed confidence or evidence |
| `unknowns` | Strings present only in A/B and shared unknowns |
| `usage.totals` | Included entries, token buckets, cost, and total tokens |
| `usage.confidence` | `reported` / `estimated` / `unknown` label changes |
| `privacy` | Redaction receipts, consent states, confidence counts, detector findings, skipped fields |
| `notes` | Human-readable summary of material differences |

A missing trace returns HTTP 404; a missing `a` or `b` query parameter returns HTTP 400.

## Verification

The Stage 3 tests cover:

- package construction, redaction, fingerprint validation, and tamper detection
- deterministic comparison of metrics, hypotheses, usage, and privacy findings
- package and compare HTTP routes, including redaction of a synthetic secret and error handling

Run them with:

```bash
npm run verify
```
