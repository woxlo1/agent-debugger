# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions aim to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes.

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
