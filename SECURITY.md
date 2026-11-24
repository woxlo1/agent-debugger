# Security Policy

## Supported versions

Only the latest `main` branch is supported.

## Reporting a vulnerability

Do **not** open a public issue for a security problem or for any report that contains secrets or customer data.

Use GitHub's private vulnerability reporting for this repository. If that is unavailable, contact the maintainer privately through GitHub and wait for a response before disclosing details publicly.

Include:

- affected component
- reproduction steps
- impact
- suggested fix, if known

## Local data handling

Agent Debugger is local-first:

- the server binds to `127.0.0.1` by default
- CORS allows only the local Vite origins by default
- `AGENT_DEBUGGER_TOKEN` protects mutating APIs
- redaction is applied on ingest, SSE, and export

Treat stored traces in `.agent-debugger/events.ndjson` as sensitive and delete them when no longer needed.
