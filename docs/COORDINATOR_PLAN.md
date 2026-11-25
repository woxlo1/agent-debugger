# Coordinator Plan

## Branch strategy

- `origin/main` is the stable base. Work is never pushed directly to it during a stage.
- Each stage uses a dedicated branch and worktree.
- A stage is merged into `main` only through a pull request after `npm run verify` passes.
- Existing local commits from the earlier phase were diverged from `origin/main`. This branch includes `origin/main` via a normal merge commit, not a reset or force push.

## Current stage

Stage 11: v1.0.0 release preparation.

Stage 11 builds on all merged implementation, review, structure, and ops stages. It bumps every workspace manifest and runtime version constant to `1.0.0`, publishes release notes in `CHANGELOG.md`, reconciles the README / security / HN documents with the approved release, refreshes the synthetic demo GIF, and prepares the tag, GitHub Release, and final Hacker News text. Real-user validation remains unexecuted, and npm publishing requires registry credentials that are not stored in this repository.

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
10. Restore the gated Dependency Review workflow and document UI-only activations.
11. Bump to v1.0.0, refresh the synthetic demo GIF, verify, open a release PR, then tag and release after merge.

## Verification for every stage

```bash
npm run typecheck
npm test
npm run verify
```

No stage is complete until all three pass locally and in GitHub Actions.

## Release policy

The repository owner granted explicit approval for the v1.0.0 version bump, tag, GitHub Release, demo GIF refresh, and Hacker News posting on 2026-11-24. CI never performs these actions. npm publish and Hacker News posting additionally require registry / HN credentials that are not stored in this repository; when unavailable, the approved text and dry-run evidence are recorded for the owner.
