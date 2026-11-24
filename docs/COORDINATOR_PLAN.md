# Coordinator Plan

## Branch strategy

- `origin/main` is the stable base. Work is never pushed directly to it during a stage.
- Each stage uses a dedicated branch and worktree.
- A stage is merged into `main` only through a pull request after `npm run verify` passes.
- Existing local commits from the earlier phase were diverged from `origin/main`. This branch includes `origin/main` via a normal merge commit, not a reset or force push.

## Current stage

Stage 5: local MCP server and consent-aware Claude local adapter.

Stage 5 builds on the merged Stage 1 usage contracts, Stage 2 server/CLI/web integration, Stage 3 Case Packages, and Stage 4 docs/assets. It adds a dependency-free stdio JSON-RPC MCP server over the local store and an opt-in, path-allowlisted Claude Code transcript reader that returns count-only usage after strict redaction. No release action is performed in this stage.

## Shared interfaces frozen by the coordinator

These files are coordinator-owned. No parallel session may edit them without coordinator approval:

- `packages/shared/src/types/*`
- `packages/protocol/src/*` (when introduced)
- `package.json`
- `package-lock.json`
- `tsconfig.base.json`
- `docs/COORDINATOR_PLAN.md`
- root `README.md`

## Ownership map

| Session | Branch | Owned files | Forbidden files |
|---|---|---|---|
| S0 coordinator | current stage branch | shared types, protocol, config, root manifests, integration docs | other sessions' owned source files |
| S1 privacy | `feat/stage-1-privacy` | `packages/privacy/**`, `packages/privacy/test/**` | shared types, server, web |
| S2 usage | `feat/stage-1-usage` | `packages/usage/**`, `packages/ingest/src/adapters/**`, usage tests | shared types, privacy internals |
| S3 server CLI | `feat/stage-2-server-cli` | `packages/server/**`, `apps/cli/**` | shared types without coordinator change |
| S4 web | `feat/stage-2-web` | `apps/web/**` | shared types, server internals |
| S5 cases artifact | `feat/stage-3-cases` | `packages/cases/**`, `packages/artifact/**`, `packages/query/**` | shared types, web |
| S6 docs assets | `feat/stage-4-docs-assets` | `docs/**`, `assets/**`, `apps/docs-site/**` | root README final merge |
| S7 ops bots | `feat/stage-4-ops` | `.github/**`, `scripts/**`, `benchmark-results/**` | package manifests |

## Integration order

1. Freeze shared AI usage and privacy contracts.
2. Implement privacy engine and usage normalizers in parallel.
3. Integrate usage routes into the server and CLI.
4. Add web views for usage and privacy audit.
5. Add case comparison and portable bundles.
6. Add docs, icons, demo GIF, docs site, and HN draft.
7. Add benchmark harness and ops bots.
8. Final `npm run verify`, then pull request to `main`.

## Verification for every stage

```bash
npm run typecheck
npm test
npm run verify
```

No stage is complete until all three pass locally and in GitHub Actions.

## Release policy

Version bump, tag, GitHub Release, npm publish, and Hacker News posting require explicit final approval. This plan does not authorize them.
