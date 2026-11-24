# Product Brief

## Product promise

Agent Debugger turns a failed agent trace into a local, evidence-linked Cause Package with reproduction steps and a concrete handoff to the debugger a developer already uses.

## Primary job to be done

When an agent run fails, inspect the captured events, separate observed facts from hypotheses, and decide where to set the next breakpoint or what to replay — without uploading the trace to another service.

## First user

Developers who build or maintain in-house agents and already have access to trace exports (NDJSON/JSON) but lack a repeatable path from a failed step to runtime evidence. This user is assumed to be comfortable with a CLI and a local web UI.

This is a target-user hypothesis from Phase 0, not a validated segment.

## Moment of use

After a failed run, when the developer opens the trace, sees an error or a repeated tool call, and asks: "What do I inspect next, and in which file?"

## Why this is meaningfully different

Phase 0 checked official documentation and repositories for Langfuse, LangSmith, LangGraph Studio, Arize Phoenix, Braintrust, Laminar, GraphMind, JoaquinCampo/agent-debugger, DebugMCP, Microsoft DebugMCP, JetBrains CLion, and OpenTelemetry GenAI semantic conventions (checked 2026-11-24).

Verified facts from that research:

- Observability and evaluation products such as Langfuse, LangSmith, Phoenix, Braintrust, and Laminar emphasize trace capture, replay, prompt management, and evaluation workflows.
- Runtime debugger projects and IDEs emphasize breakpoints, stepping, and process attachment.
- A verified direct, primary-source link from an arbitrary agent trace event to runtime stack or variable state was not found during that research.

Inference from those facts:

- A focused tool that converts trace evidence into reproduction steps and an explicit debugger handoff occupies a narrow, testable gap. It does not replace observability, evaluation, or debugger control planes.

Product hypothesis (not validated):

- `A local, rule-based Cause Package helps the target developer reach a plausible cause and a concrete next debugging action faster than reading the raw trace alone.`

## Scope of the first complete path

Included:

- Versioned event schema (`schemaVersion: 2`)
- NDJSON/JSON import and redaction
- Local file-backed event store
- Deterministic, rule-based evidence extraction
- Cause candidates with falsifiers
- Reproduction steps and debugger handoff text
- Redacted NDJSON export
- CLI and local web UI for the same workflow

Explicitly deferred:

- Live pause/inject, execution modification, and expression evaluation
- A custom Debug Adapter Protocol implementation
- Evaluation, datasets, and scoring
- Cloud sync, accounts, and hosted service
- External AI explanations (possible only as a separate, explicit-consent feature)
- Repository or npm package renaming

## Labels used in this repository

- **Verified fact**: supported by an inspected source or by code that exists in this repository.
- **Inference**: an interpretation of verified facts.
- **Hypothesis**: a testable claim that has not been validated with users.
- **Open question**: requires evidence before a decision.

## Adoption measures (proposed, not achieved)

- Time from clone to a successful `npm run demo` and first Cause Package.
- Whether a new user can identify the seeded failure without assistance.
- Whether a target user can import one of their own redacted traces.
- Completion rate of import → evidence → handoff.
- Qualitative reports of which tool the user would otherwise have used.

These are proposed measurements. No user results are claimed.
