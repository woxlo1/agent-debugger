# Operations Bots

## Enabled by workflow files

These workflows run with repository files only. No new secret, paid service, or external account was added.

| Workflow | Purpose | Credentials |
|---|---|---|
| `ci.yml` | Runs `npm run verify` on Node 20 and 22 | `GITHUB_TOKEN` only |
| `codeql.yml` | JavaScript/TypeScript security analysis | `GITHUB_TOKEN` with `security-events: write` |
| `gitleaks.yml` | Detects committed secrets | `GITHUB_TOKEN` only; synthetic fixtures are allowlisted |
| `scorecard.yml` | Supply-chain posture check, SARIF artifact, no public badge | `GITHUB_TOKEN` only |

## Configured but requiring app activation

| Bot | Config | Activation status |
|---|---|---|
| Dependabot | `.github/dependabot.yml` | Config added. GitHub-side enablement is not changed by this branch. |
| Renovate | `renovate.json` | Config added. Installing the Renovate GitHub App requires explicit approval. |
| Dependency Review | Approval-gated workflow | The workflow file was removed after CI reported that Dependency graph is disabled. Enabling it in repository settings requires explicit approval. |

## Deliberately not added

- Codecov or other upload-first coverage services: would add an external service and token.
- External AI review bots: the default policy forbids external AI calls without explicit consent.
- Release automation: `release.yml` remains approval-gated.
