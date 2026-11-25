# Hacker News launch draft

> **Status: APPROVED FOR POSTING.** The repository owner approved the final text and the act of posting on 2026-11-24, and approved the `v1.0.2` URL/text update on 2026-11-25. Post only after the v1.0.2 release URL resolves and the refreshed synthetic demo GIF is committed to `main`. No external AI service call, credential creation, or secret logging is involved.

## Suggested title

Show HN: Agent Debugger – local-first failure debugger for AI agents

Alternative title:

Show HN: Turn a failed agent trace into evidence, hypotheses, and a debugger handoff

## Target URL

Use the approved release URL:

```text
https://github.com/woxlo1/agent-debugger/releases/tag/v1.0.2
```

Do not substitute a pre-release branch, a fork, or a short link.

## Submission comment draft

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
a consent-aware AI usage ledger, portable redacted bundles with a
SHA-256 fingerprint, a local MCP server, and a one-command browser-based
desktop shell.

Everything runs on localhost. There is no account, no cloud, and no external
AI service call. Redaction runs on ingest, stream, export, and bundle
creation. Usage values are labelled reported, estimated, or unknown, and
estimates are excluded from billing totals unless you opt in.

This is v1.0.2 of a local debugging tool, not a finished observability
platform. It does not do evals, live injection, or team trace storage.
Cause candidates are hypotheses, not verified root causes. A generated docs
site, local MCP server, browser-based desktop shell, and published synthetic
benchmarks are included. The security review is in the repo, but it is a
self-review, not an audit. Real-user validation has not been executed, so I
am not claiming the cause packages are proven to save time. Cold start also
misses the 500 ms target in the published benchmark.

Feedback on the cause/hypothesis split, the privacy model, or the CLI
workflow is especially welcome.

Release: https://github.com/woxlo1/agent-debugger/releases/tag/v1.0.2
Repo: https://github.com/woxlo1/agent-debugger
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
- [x] The owner approved the version bump, tag, GitHub Release, demo GIF refresh, final text, and posting on 2026-11-24, and the `v1.0.2` text/URL update on 2026-11-25.
- [x] The target URL resolves to the approved v1.0.2 release after the tag is pushed.
- [x] The demo GIF contains only synthetic data from `docs/examples/failed-trace.ndjson`.
- [x] No secrets, customer data, or internal hostnames appear in the repository or in the comment.
- [x] `agent-debugger-server@1.0.2` is published on npm (`latest = 1.0.2`); the publish build and dry run were verified.
- [x] `agent-debugger-sdk@1.0.2` is published after the owner approved the staged release with 2FA; `latest = 1.0.2`. This does not change the release URL.
- [ ] HN posting requires an authenticated session. If no HN credential is available in this environment, use the final text above to post manually.
