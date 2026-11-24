# Security Review

## Scope and status

This is a local-first security review of the v1.0.0 repository as of 2026-11-24. It covers the API, CLI, local store, web UI, desktop shell, MCP server, and Claude Code local adapter. It is not a penetration test, a formal audit, or a claim that the product is free of vulnerabilities. The `v1.0.1` patch applies the correctness and privacy fixes listed in `CHANGELOG.md`; the review scope and trust boundaries are unchanged.

Version is `1.0.1`; the original review covered `1.0.0`. The repository owner approved the v1.0.0 version bump, tag, GitHub Release, demo GIF refresh, and Hacker News posting, and later approved the v1.0.1 patch with local npm authentication, on 2026-11-24. npm publishing requires registry credentials that are not available in this environment. This document records the review; it does not itself grant approval.

## Assets and trust boundaries

| Asset | Trust boundary |
|---|---|
| Imported trace events, prompts, tool inputs/outputs | Agent process or pasted NDJSON → local API/store |
| Cause Package bundles and case comparisons | Local store → API → UI/export/MCP client |
| AI usage entries and redaction receipts | Provider response or adapter → usage ledger |
| Claude Code transcript files | Local filesystem → opt-in adapter → count-only usage result |
| Local API and desktop shell | Loopback process → browser on `127.0.0.1` |

### Threat model

The review considered these adversaries:

1. **Malicious trace content** that tries to leak secrets, inject instructions into cause text, or alter exported bundles.
2. **A local website or process** that tries to reach the loopback API without the user's intent.
3. **An over-broad MCP/Claude adapter request** that tries to read files outside an explicitly allowed root.
4. **Accidental secret commit** through fixtures, docs, or test code.
5. **Supply-chain or CI privilege escalation** through workflows or third-party actions.

Out of scope: protection against a malicious process running as the same OS user, OS sandbox escape, multi-tenant hosting, real debugger injection, or live modification of a running agent.

## Reviewed controls

### Local network surface

- The API binds to `127.0.0.1` by default via `AGENT_DEBUGGER_HOST`.
- The desktop shell binds both its static server and API child to `127.0.0.1`, uses OS-assigned free ports, and never opens a non-loopback listener.
- The shell proxies only fixed-origin `/api/*` requests to the local API. The destination protocol and host are not taken from the incoming request.
- Proxy hop-by-hop headers are not forwarded, and responses use `Cache-Control: no-store`.
- MCP is stdio JSON-RPC 2.0. It opens no port and calls no external service.
- No code path in this release calls an external AI service, uploads a trace, or requires an account or credential.

### Redaction and usage privacy

- Redaction runs on import, event submission, SSE output, NDJSON export, and portable Cause Package export.
- Redaction receipts store detector counts and booleans only, never raw matched values.
- Usage values are allowlisted and labelled `reported`, `estimated`, or `unknown`. Local estimates are excluded from billing totals by default.
- Claude Code and claude.ai Web usage require explicit consent before inclusion in totals.
- `record_usage` rejects `claude_code_local` and `claude_web_export` sources so callers cannot bypass the consent path.
- The Claude adapter applies strict redaction before normalization and returns only count usage fields plus a redaction receipt. It never returns transcript text, raw payloads, or the source path.
- The `v1.0.1` patch also redacts event names, errors, and source paths before storing or exporting, and verifies `integrity.sha256` on portable Cause Package bundles.

### Claude Code local adapter

The adapter is off unless `AGENT_DEBUGGER_CLAUDE_LOCAL=enabled`. Each request must also provide `consentGranted: true` and `acknowledgedScope: true`.

Additional controls:

- Target must be an absolute `.jsonl` path.
- `allowedRoots` must be a non-empty array of absolute, existing directories.
- Containment is enforced on both the supplied path and `fs.realpathSync` of the target. This blocks a `.jsonl` symlink inside an allowed root from pointing to a transcript outside it.
- Targets must be regular files, at most 10 MB, and at most 5,000 parsed records.
- Invalid JSON lines are skipped and counted without echoing their content.

### API and browser boundary

- CORS allows only `http://localhost:5173` and `http://127.0.0.1:5173` by default. `AGENT_DEBUGGER_ALLOWED_ORIGINS` can narrow or replace this list.
- `AGENT_DEBUGGER_TOKEN` optionally requires `x-agent-debugger-token` on mutating APIs.
- The web UI does not send `AGENT_DEBUGGER_TOKEN`. If a token is configured, mutating UI actions are rejected by design. This is documented in `docs/DESKTOP_SHELL.md` and remains a known usability limitation.

### Repository and CI

- Workflow permissions are scoped per job. CI and Gitleaks use `contents: read`; CodeQL adds `actions: read` and `security-events: write`; Scorecard adds `id-token: write` but sets `publish_results: false`.
- Workflows use `persist-credentials: false` on checkout.
- Gitleaks allowlists only documented synthetic fixtures and test paths; fake secrets in tests are explicitly enumerated.
- CodeQL uses the default query suite. The earlier `security-extended` configuration produced local-first false positives in the loopback API and was removed.
- Dependabot covers npm and GitHub Actions. Renovate config is ready and approval has been granted, but the GitHub App installation is a UI-only action that remains with the repository owner.
- Dependency Graph activation is a UI-only action that remains with the owner. The Dependency Review workflow is restored but skipped until the repository variable `DEPENDENCY_GRAPH_ENABLED=true` is set.
- No workflow performs a version bump, tag, release, publish, or Hacker News post.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| SEC-01 | Medium | The Claude adapter originally validated only lexical paths. A symlink inside `allowedRoots` could resolve to a transcript outside the root. | Fixed in Stage 8. Roots and target are canonicalized with `realpathSync`; containment is checked on both lexical and real paths before reading. A symlink-escape regression test was added. The test is skipped only when the OS denies symlink creation; CI on Linux exercises it. |
| SEC-02 | Medium | Stage 6 CodeQL reported request forgery in the desktop proxy because the fetch URL was derived from the incoming request. | Fixed in `c50f397`. The proxy builds a URL from a fixed local `apiBase` and copies only path/search from the loopback request. An explicit suppression documents the intentional pattern. CI rerun is green. |
| SEC-03 | Low | Stage 6 CodeQL reported user-visible error text derived from exceptions. | Fixed in `c50f397`. Proxy errors now return a generic message with no stack or path detail. CI rerun is green. |
| SEC-04 | Low | API tests used fixed random port ranges and could fail when another local process held a port. | Fixed in Stage 5 with OS-assigned free ports. This is an availability/flakiness issue, not a data disclosure. |
| SEC-05 | Accepted | If `AGENT_DEBUGGER_TOKEN` is set, the current web UI cannot perform mutating actions because it does not send the token. | Documented as an intentional mismatch rather than silently weakening API auth. Token-protected mutation remains available through CLI/API clients. |

No finding in this review authorized a release by itself. The v1.0.0 release and the v1.0.1 patch were approved separately by the repository owner on 2026-11-24.

## Residual risks

- A malicious process running as the same OS user can read local files, environment variables, and the local event store. Agent Debugger does not provide OS-level isolation.
- If `AGENT_DEBUGGER_TOKEN` is unset, a malicious local webpage may attempt browser-based requests to the loopback API. CORS blocks JSON cross-origin reads and preflights, but the token is the stronger control for mutating endpoints.
- Redaction is pattern-based and count-oriented. Novel secret formats or deliberately obfuscated values may not be detected. Exported bundles reduce exposure by carrying counts and placeholders, but local stores still contain redacted events only after the configured redactor runs.
- The Claude adapter trusts the MCP caller's consent and allowlist assertions. It prevents path escapes and limits output, but it cannot verify the caller's intent or sandbox the local user.
- Automated tests cover deterministic logic and local transport. They do not prove that cause candidates are correct or useful to developers.
- Real-user validation has **not** been executed. See `docs/VALIDATION_PLAN.md`.
- Supply-chain posture still requires repository-settings UI actions. Explicit approval has been granted for Renovate and Dependency Graph, but GitHub provides no REST endpoint for either activation. The Dependency Review workflow is restored but skipped until Dependency Graph is enabled in Settings → Advanced Security and the repository variable `DEPENDENCY_GRAPH_ENABLED=true` is set.

## CI evidence

Merged stage PRs were only merged after all required checks were green:

- PR #2 (Stage 1), #14 through #19 (Stages 2–7), #21 (Stage 9), and #22 (Stage 10). Stage 8 was merged as PR #20.
- Required checks: `verify (Node 20)`, `verify (Node 22)`, `Analyze JavaScript/TypeScript`, and `Detect committed secrets`. `Review dependency changes` is skipped until the Dependency Graph variable gate is enabled.
- Stage 6 initially failed CodeQL with SEC-02 and SEC-03. The fix commit `c50f397` was pushed before merge and the rerun was green.
- The OpenSSF Scorecard workflow runs on `main` and weekly, with results uploaded as an artifact and SARIF; it is not a required PR gate.

Stage 9 (#21) and Stage 10 (#22) CI were green before merge. PR #24 (`fix/publish-readiness`) was merged with all required checks green. The v1.0.1 release pull request is validated by `npm run verify` and the same required checks. This document records that approval; it does not grant it.

## Recommendation

The implementation is suitable for local v1.0.1 use with synthetic or consented, pre-redacted traces. Do not describe it as audited or production-hardened. Keep the residual risks explicit: real-user validation is unexecuted, cold start misses the 500 ms target, and the remaining supply-chain activations are owner UI actions.
