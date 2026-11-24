# Hacker News launch draft (do not post)

> **Status: DRAFT.** Do not submit to Hacker News, edit external profiles, or publish a release without explicit approval from the repository owner. This file is preparation only.

## Suggested title

Show HN: Agent Debugger – local-first failure debugger for AI agents

Alternative title:

Show HN: Turn a failed agent trace into evidence, hypotheses, and a debugger handoff

## Target URL

Use the repository URL after the v1.0.0 release is approved and tagged:

```text
https://github.com/woxlo1/agent-debugger
```

Do not substitute a pre-release branch, a fork, or a short link.

## Submission comment draft

```text
Hi HN,

I built Agent Debugger because debugging a failed agent run usually means
scroll-searching a long trace and guessing which tool call mattered.

Agent Debugger is local-first and MIT licensed. You import an NDJSON trace
(or pipe events from any language), and it builds a "Cause Package":

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

This is an alpha, not a finished observability platform. It does not do
evals, live injection, or team trace storage. Cause candidates are
hypotheses, not verified root causes. A generated docs site, local MCP server,
and browser-based desktop shell are included; published benchmarks and
real-user validation are still in the v1.0.0 scope.

Feedback on the cause/hypothesis split, the privacy model, or the CLI
workflow is especially welcome.

Repo: https://github.com/woxlo1/agent-debugger
Demo GIF: https://github.com/woxlo1/agent-debugger/blob/main/docs/assets/demo.gif
```

## Likely questions and short answers

| Question | Answer |
|---|---|
| Why not LangSmith / Langfuse / Phoenix? | Those are observability platforms. This is a local debugging step for one failed run, with no account or upload. |
| Does it call an LLM to explain failures? | No. Analysis is rule-based and deterministic. External AI adapters are not enabled. |
| How is privacy handled? | Redaction is applied on ingest, stream, export, and package export. Receipts store detector counts only. Claude sources require explicit consent before inclusion. |
| Why a SHA-256 fingerprint, not a signature? | It detects accidental edits to a bundle. It does not establish trust in the source file; that is stated in the docs. |
| Is it production ready? | No. It is alpha. Performance targets are documented but not yet benchmarked. |

## Preflight checklist (all must be true before posting)

- [ ] All v1.0.0 scope items are complete and `npm run verify` passes.
- [ ] Version, tag, GitHub Release, and package publish have explicit approval and are done.
- [ ] The target URL resolves to the approved release.
- [ ] The demo GIF contains only synthetic data.
- [ ] No secrets, customer data, or internal hostnames appear in the repository or in the comment.
- [ ] The repository owner explicitly approves the final text and the act of posting.
