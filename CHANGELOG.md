# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions aim to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub issue templates, pull request template, and CI workflow
- Contributing, security, and code of conduct guidance

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
