# Hacker News launch draft

> **Status: APPROVED FOR POSTING.** The repository owner approved the final text and the act of posting on 2026-11-24, approved the `v1.0.2` URL/text update on 2026-11-25, approved the 19:00 JST posting with the repository URL and revised title on 2026-11-25, and approved the 68-character alternative title on 2026-11-25 because the original title exceeded the Hacker News 80-character limit. Post manually from an authenticated browser at the approved time. No external AI service call, credential creation, or secret logging is involved.

## Suggested title

Show HN: Agent Debugger – local-first failure debugger for AI agents

The earlier title `Show HN: Agent Debugger – replay failed agent traces into evidence and a debugger handoff` is 89 characters and exceeds the Hacker News 80-character limit. Do not use it.

## Target URL

Use the approved repository URL for the 19:00 posting:

```text
https://github.com/woxlo1/agent-debugger
```

Keep the `v1.0.2` release URL in the comment below. Do not use a fork or a short link.

## Submission comment draft

Post this as the maker comment at 19:02, immediately after the 19:00 submission.

```text
Hi HN,

I built Agent Debugger because debugging a failed agent run usually means
scroll-searching a long trace and guessing which tool call mattered.

Agent Debugger v1.0.2 is local-first and MIT licensed. You import an NDJSON
trace (or pipe events from any language), and it builds a "Cause Package":

- observed evidence with event IDs
- rule-based cause candidates, each with a falsifier
- reproduction steps
- a handoff suggestion pointing at your existing debugger

It also has a Compare view for diffing a failing run against a passing one,
a consent-aware AI usage ledger, portable redacted bundles with a SHA-256
fingerprint, a local MCP server, and a one-command browser-based desktop shell.

Quick start:
  npx agent-debugger-server start

That runs the local API and CLI. For the web UI, clone the repo and run:
  npm run desktop

Everything runs on localhost. There is no account, no cloud, and no external
AI service call. Redaction runs on ingest, stream, export, and bundle
creation. Usage values are labelled reported, estimated, or unknown, and
estimates are excluded from billing totals unless you opt in.

This is v1.0.2 of a local debugging tool, not a finished observability
platform. It does not do evals, live injection, or team trace storage.
Cause candidates are hypotheses, not verified root causes. The security
review is in the repo, but it is a self-review, not an audit. Real-user
validation has not been executed, so I am not claiming the cause packages
are proven to save time. Cold start also misses the 500 ms target in the
published benchmark.

Feedback on the cause/hypothesis split, the privacy model, or the CLI
workflow is especially welcome.

Repo: https://github.com/woxlo1/agent-debugger
Release: https://github.com/woxlo1/agent-debugger/releases/tag/v1.0.2
Demo GIF: https://github.com/woxlo1/agent-debugger/blob/main/docs/assets/demo.gif
```

## Likely questions and short answers

| Question | Answer |
|---|---|
| Why not LangSmith / Langfuse / Phoenix? | Those are observability platforms. This is a local debugging step for one failed run, with no account or upload. |
| Does it call an LLM to explain failures? | No. Analysis is rule-based and deterministic. External AI adapters are not enabled. |
| How is privacy handled? | Redaction is applied on ingest, stream, export, and package export. Receipts store detector counts only. Claude sources require explicit consent before inclusion. |
| Is this security-audited? | No. `docs/SECURITY_REVIEW.md` records the threat model, findings, fixes, and residual risks. It is a self-review, not an external audit. |
| Why a SHA-256 fingerprint, not a signature? | It detects accidental edits to a bundle. It does not establish trust in the source file; that is stated in the docs. |
| Is it production ready? | It is v1.0.2 for local debugging, not a hosted production service. Synthetic benchmarks are published in `docs/PERFORMANCE.md`; cold start misses the 500 ms target and real-user validation has not run. |

## Preflight checklist

- [x] All v1.0.2 scope items are complete and `npm run verify` passes.
- [x] The owner approved the version bump, tag, GitHub Release, demo GIF refresh, final text, and posting on 2026-11-24, the `v1.0.2` text/URL update on 2026-11-25, the 19:00 JST post with the repository URL and revised title, and the 68-character replacement title after confirming the Hacker News 80-character limit.
- [x] Both the repository URL and the `v1.0.2` release URL resolve.
- [x] The demo GIF contains only synthetic data from `docs/examples/failed-trace.ndjson`.
- [x] No secrets, customer data, or internal hostnames appear in the repository or in the comment.
- [x] `agent-debugger-server@1.0.2` is published on npm (`latest = 1.0.2`); the publish build and dry run were verified.
- [x] `agent-debugger-sdk@1.0.2` is published after the owner approved the staged release with 2FA; `latest = 1.0.2`. This does not change the release URL.
- [x] The owner approved posting at 19:00 JST on 2026-11-25, a maker comment at 19:02, and same-day question replies through the US morning.
- [ ] HN posting requires an authenticated session; post manually from a signed-in browser at the approved time using the final text above.
