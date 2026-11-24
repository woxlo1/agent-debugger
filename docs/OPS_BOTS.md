# Operations Bots

## Enabled by workflow files

These workflows run with repository files only. No new secret, paid service, or external account was added.

| Workflow | Purpose | Credentials |
|---|---|---|
| `ci.yml` | Runs `npm run verify` on Node 20 and 22 | `GITHUB_TOKEN` only |
| `codeql.yml` | JavaScript/TypeScript security analysis | `GITHUB_TOKEN` with `security-events: write` |
| `gitleaks.yml` | Detects committed secrets | `GITHUB_TOKEN` only; synthetic fixtures are allowlisted |
| `scorecard.yml` | Supply-chain posture check, SARIF artifact, no public badge | `GITHUB_TOKEN` only |
| `dependency-review.yml` | Reviews dependency changes in pull requests | `GITHUB_TOKEN` with `contents: read` |

## Configured but requiring app activation

| Bot | Config | Activation status |
|---|---|---|
| Dependabot | `.github/dependabot.yml` | Native GitHub config; no separate app installation is needed. |
| Renovate | `renovate.json` | Config is ready and approval has been granted. Installing the Renovate GitHub App is a repository-settings UI action with no REST endpoint; it remains to be done by the repository owner. |
| Dependency Graph | GitHub Advanced Security settings | Approval has been granted, but GitHub exposes no REST endpoint to enable it. It must be enabled from Settings → Advanced Security in the repository UI. |
| Dependency Review | `.github/workflows/dependency-review.yml` | Workflow restored with `continue-on-error: true` so it reports without blocking while Dependency Graph is disabled. Remove that line after enabling Dependency Graph in the repository UI. |

## Deliberately not added

- Codecov or other upload-first coverage services: would add an external service and token.
- External AI review bots: the default policy forbids external AI calls without explicit consent.
- Release automation: `release.yml` remains approval-gated.
