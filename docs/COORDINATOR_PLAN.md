# Coordinator Plan

## Branch strategy

- `origin/main` is the stable base. Work is never pushed directly to it during a stage.
- Each stage uses a dedicated branch and worktree.
- A stage is merged into `main` only through a pull request after `npm run verify` passes.
- Existing local commits from the earlier phase were diverged from `origin/main`. This branch includes `origin/main` via a normal merge commit, not a reset or force push.

## Current stage

Stage 9: final project structure and validation kit.

Stage 9 builds on all merged implementation and review stages. It declares the current `packages/`, `scripts/`, `docs/`, and `docs-site/` layout final for the 1.0.0 line, adds `docs/PROJECT_STRUCTURE.md`, and adds ready-to-use validation materials in `docs/VALIDATION_KIT.md` and `docs/validation/`. The study itself remains unexecuted. No release action is performed in this stage.

## Shared interfaces frozen by the coordinator

These files are coordinator-owned. No parallel session may edit them without coordinator approval:

- `packages/shared/src/types/*`
- `packages/protocol/src/*` (when introduced)
- `package.json`
- `package-lock.json`
- `tsconfig.base.json`
- `docs/COORDINATOR_PLAN.md`
- root `README.md`

## Final ownership map

| Area | Files | Owner | Change rule |
|---|---|---|---|
| Shared contracts | `packages/shared/src/types/**` | Coordinator | Explicit contract change required |
| Privacy and usage | `packages/privacy/**`, `packages/usage/**`, `packages/ingest/**` | Privacy/usage owner | Add tests with every behavior change |
| Runtime core | `packages/server/**`, `packages/cases/**`, `packages/artifact/**` | Server owner | API changes require integration tests |
| Local interfaces | `packages/mcp/**`, `packages/sdk/**` | Interface owner | Preserve local-only and consent contracts |
| Web UI | `packages/web/**` | Web owner | No direct API token handling |
| Tooling | `scripts/**` | Tooling owner | Add script tests under `scripts/test/` |
| Documentation | `docs/**` | Docs owner | Regenerate `docs-site/` in the same PR |
| Generated site | `docs-site/**` | Generated | Never edit HTML by hand |
| Automation | `.github/**`, `renovate.json` | Ops owner | Least-privilege permissions and PR review |
| Root manifests | `package.json`, `package-lock.json`, `README.md` | Coordinator | Version bumps require release approval |

The final layout is documented in `docs/PROJECT_STRUCTURE.md`. No `apps/` migration is planned for 1.0.0.

## Integration order

1. Freeze shared AI usage and privacy contracts.
2. Implement privacy engine and usage normalizers in parallel.
3. Integrate usage routes into the server and CLI.
4. Add web views for usage and privacy audit.
5. Add case comparison and portable bundles.
6. Add docs, icons, demo GIF, docs site, and HN draft.
7. Add benchmark harness and ops bots.
8. Document final security review and unexecuted validation status.
9. Freeze final project structure and prepare validation materials.
10. Final `npm run verify`, then pull request to `main`.

## Verification for every stage

```bash
npm run typecheck
npm test
npm run verify
```

No stage is complete until all three pass locally and in GitHub Actions.

## Release policy

Version bump, tag, GitHub Release, npm publish, and Hacker News posting require explicit final approval. This plan does not authorize them.
