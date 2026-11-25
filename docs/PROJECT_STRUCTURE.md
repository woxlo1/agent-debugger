# Project Structure

## Status

This is the final repository structure for the 1.0.x line, including the 1.0.1 patch. No `apps/` layer is introduced. The current `packages/`, `scripts/`, `docs/`, and `docs-site/` split is kept because it matches the actual build, test, and release boundaries and avoids a destructive migration of user work.

## Layout

```text
agent-debugger/
├── .github/
│   ├── dependabot.yml          npm and GitHub Actions updates
│   ├── renovate.json           Renovate policy (app activation is separate)
│   └── workflows/              CI, CodeQL, Gitleaks, Scorecard, Dependency Review
├── docs/
│   ├── assets/                 Icon, favicon, social card, demo GIF
│   ├── examples/               Synthetic NDJSON fixtures
│   ├── validation/             Consent, session, and results templates
│   ├── *.md                    Product, architecture, privacy, security, ops docs
│   └── benchmark-results.json  Raw benchmark measurements
├── docs-site/                  Generated static site; do not edit HTML by hand
├── packages/
│   ├── shared/                 Frozen usage, consent, and privacy contracts
│   ├── privacy/                Count-only redaction engine
│   ├── ingest/                 Provider and local transcript normalizers
│   ├── usage/                  Consent-aware usage ledger
│   ├── artifact/               Portable Cause Package builder and verifier
│   ├── cases/                  Deterministic case comparison
│   ├── mcp/                    stdio JSON-RPC server and Claude local adapter
│   ├── server/                 Fastify API, importer, analyzer, store, CLI
│   ├── sdk/                    TypeScript event client
│   ├── web/                    React + Vite + Tailwind UI
│   └── example-agent/          Synthetic demo trace emitter
├── scripts/
│   ├── desktop.mjs             Browser-based local desktop launcher
│   ├── bench.ts                Synthetic benchmark harness
│   ├── build-docs.mjs          Static docs site generator
│   ├── lib/                    Shared local server helpers
│   └── test/                   Script-level tests
├── package.json                Private root manifest and scripts
├── package-lock.json           Lockfile for workspaces and root dev tools
└── README.md                   Project entry point
```

## Why this structure is final

- `packages/` contains reusable or runtime code with its own `tsconfig.json` and tests where applicable.
- `scripts/` contains local tooling that is not imported as a package.
- `docs/` is the source of truth for documentation and assets; `docs-site/` is generated from it.
- `.github/` contains automation only and never holds application logic.
- The root `package.json` is private. Publishing, if approved, happens per distributable package (`agent-debugger-sdk`, `agent-debugger-server`), not from the root.
- The desktop shell is browser-based and stays in `scripts/`; no native Electron/Tauri workspace is added for 1.0.x.

## Rules for changes

| Change | Add it to |
|---|---|
| A new event source normalizer | `packages/ingest/src/adapters/` with a test in `packages/ingest/test/` |
| A new redaction detector | `packages/privacy/` with a count-only receipt test |
| A new analyzer rule | `packages/server/src/analyzer.ts` with a fixture assertion |
| A new API route | `packages/server/src/index.ts` with an API test |
| A new MCP tool | `packages/mcp/src/tools.ts` with a protocol test |
| A new local command | `scripts/` with a test in `scripts/test/` |
| A new user guide | `docs/` then regenerate `docs-site/` with `npm run build:docs` |
| A new CI check | `.github/workflows/` with least-privilege permissions |

Shared contracts under `packages/shared/src/types/` remain coordinator-owned. Do not edit them from a feature branch without an explicit contract change.

## Release surfaces

| Surface | Location | Publishing rule |
|---|---|---|
| CLI / server package | `packages/server` | Requires explicit release approval |
| SDK package | `packages/sdk` | Requires explicit release approval |
| Documentation site | `docs-site/` | Static files only; no hosting is configured by this repository |
| Desktop shell | `scripts/desktop.mjs` | Local launcher; no native binary is distributed |
| Container / cloud service | Not included | Out of scope |

## Non-goals

- No `apps/` migration.
- No monorepo tool beyond npm workspaces.
- No package rename or repository rename.
- No generated-code directory other than `docs-site/`.
- No runtime dependency added solely to make the structure look conventional.
