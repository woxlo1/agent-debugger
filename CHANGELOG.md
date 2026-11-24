# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions aim to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes.

## [1.0.2] - 2026-11-24

### Fixed

- `npm run demo` no longer fails with `ERR_MODULE_NOT_FOUND`: the example agent imported the SDK with a wrong relative path.
- The OpenSSF Scorecard workflow now uses `ossf/scorecard-action@v2.4.4`; `v2.4.0` pulled its image from `gcr.io`, which fails.

### Changed

- `packages/server` and `packages/sdk` now carry their own `README.md` and `LICENSE`, so their npm package pages are populated.
- `agent-debugger-server`'s README states that the package ships the local API and CLI only; the web UI runs from a repository checkout.
- Refreshed `demo.gif` (cropped to the app, Cause Package evidence through debugger handoff).
- All workspace manifests, the lockfile, and runtime version constants now report `1.0.2`.

### Release approval

The repository owner approved the v1.0.2 patch release on 2026-11-24. No external AI service call, upload, credential creation, or secret logging was performed.

## [1.0.1] - 2026-11-24

### Fixed

- `agent-debugger-sdk` now ships compiled JS and declarations via a `prepack` build.
- `agent-debugger-server` now ships a self-contained compiled server and runs it without `tsx`.
- Explicit token totals are preserved when mixed with token bucket entries.
- Claude local/web usage submitted through the bulk API can no longer bypass consent.
- Cause Package analysis, usage, privacy, and event string fields are redacted before hashing; `integrity.sha256` is verified.
- Audio and cached token subsets are no longer double counted in OpenAI, LangChain, and OpenTelemetry adapters.
- `agent-debugger pipe` exits non-zero when any event fails to send.
- ISO 8601 timestamps and explicit import `traceId` overrides are honored.
- Usage sources are validated and `manual_import` keeps its source label.
- Event names, errors, and source paths are redacted on ingest and in the SDK; SDK redaction no longer mutates prototypes.
- Compare/replay UI races, MCP notification responses, desktop child cleanup, static shell fallback, and cold-start timing were corrected.

### Changed

- All workspace manifests and runtime version constants now report `1.0.1`.
- The `v1.0.0` tag and GitHub Release remain unchanged; this patch supersedes the npm package contents only.

### Release approval

The repository owner approved the v1.0.1 patch release and local npm authentication on 2026-11-24. No external AI service call, upload, credential creation, or secret logging was performed.

## [1.0.0] - 2026-11-24

### Added

- Versioned event schema (`schemaVersion: 2`) with `status`, `error`, `parentId`, `source`, and `durationMs`
- NDJSON / JSON trace importer with redaction
- File-backed local event store
- Deterministic rule-based Cause Package analyzer
- Cause Package UI with observed evidence, candidates, reproduction steps, and debugger handoff
- CLI commands: `import` and `analyze`
- Optional token protection for mutating APIs
- Portable redacted Cause Package bundles with a SHA-256 fingerprint
- Case comparison across two local traces
- Consent-aware AI usage ledger with reported / estimated / unknown labels
- Local stdio MCP server and opt-in Claude Code local adapter
- Browser-based local desktop shell with loopback-only listeners
- Synthetic benchmark harness and published results
- Generated static docs site, final project structure doc, and validation kit
- Security review with threat model, findings, fixes, and residual risks

### Changed

- Server now binds to `127.0.0.1` by default
- CORS is restricted to local Vite origins
- SDK delivery failures are returned explicitly instead of being silent
- Pipe bridge no longer logs raw invalid lines
- Claude adapter validates both lexical and real paths within allowed roots
- Dependency Review workflow is restored but gated until Dependency Graph is enabled
- All workspace manifests and runtime version constants now report `1.0.0`

### Removed

- No live pause/inject, eval, cloud, or custom DAP implementation was added
- No native Electron/Tauri binary is distributed

### Known limitations

- Real-user validation has **not** been executed. Materials are ready in `docs/VALIDATION_KIT.md`, but there are no participants, consented real traces, or ground-truth results. No user-time or success-rate claim is made.
- Cold start to `/api/health` measured 683.01 ms, above the 500 ms target. Import, analysis, package export, memory, and web bundle targets were met.
- The security review is a self-review, not an external audit.
- Dependency Graph and Renovate activation require repository-settings UI actions by the owner; GitHub provides no REST endpoint for them.
- npm publishing is approved but requires registry authentication. `npm publish --dry-run` was verified for the distributable packages.

### Release approval

The repository owner explicitly approved the v1.0.0 version bump, tag, GitHub Release, demo GIF refresh, and Hacker News posting on 2026-11-24. No external AI service call, upload, credential creation, or secret logging was performed.

## [0.3.0-alpha.0] - 2026-11-24

### Added

- Versioned event schema (`schemaVersion: 2`) with `status`, `error`, `parentId`, `source`, and `durationMs`
- NDJSON / JSON trace importer with redaction
- File-backed local event store
- Deterministic rule-based Cause Package analyzer
- Cause Package UI with observed evidence, candidates, reproduction steps, and debugger handoff
- CLI commands: `import` and `analyze`
- Optional token protection for mutating APIs

### Changed

- Server now binds to `127.0.0.1` by default
- CORS is restricted to local Vite origins
- SDK delivery failures are returned explicitly instead of being silent
- Pipe bridge no longer logs raw invalid lines

### Removed

- No live pause/inject, eval, cloud, or custom DAP implementation was added
