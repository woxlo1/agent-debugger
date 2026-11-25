# MCP Server and Claude Local Adapter

## Local MCP server

Stage 5 exposes the existing local debugger as a Model Context Protocol (MCP) server over stdio. It uses JSON-RPC 2.0 and Node built-ins only; no MCP SDK, credential, network listener, or external AI service is added.

```bash
npm run mcp
```

The process reads one JSON-RPC request per line from stdin and writes one response per line to stdout. It supports `initialize`, `ping`, `tools/list`, and `tools/call`. Notifications are acknowledged implicitly and produce no response.

### Example client configuration

For a local MCP client that supports command-based servers:

```json
{
  "mcpServers": {
    "agent-debugger": {
      "command": "node",
      "args": ["--import", "tsx", "packages/mcp/src/index.ts"],
      "cwd": "/absolute/path/to/agent-debugger",
      "env": {
        "AGENT_DEBUGGER_STORE": "/absolute/path/to/agent-debugger/.agent-debugger/events.ndjson"
      }
    }
  }
}
```

`cwd` and the store path should be absolute. The server binds to no port and uses the same local NDJSON store as the API and CLI.

### Tools

| Tool | Purpose |
|---|---|
| `list_traces` | List locally stored traces |
| `analyze_trace` | Build the deterministic Cause Package for one trace |
| `get_cause_package` | Export a redacted portable bundle with fingerprint |
| `compare_traces` | Diff two local traces |
| `get_usage` | Read the consent-aware usage ledger |
| `get_privacy_audit` | Read count-only redaction and consent counters |
| `import_trace` | Import NDJSON/JSON into the local store (redacted on ingest) |
| `record_usage` | Normalize and store a caller-supplied provider usage payload |
| `read_claude_local_usage` | Opt-in, path-allowlisted Claude Code local transcript reader |

`record_usage` intentionally rejects `claude_code_local` and `claude_web_export`. Those sources must go through the consent-aware path below.

## Claude local adapter

Claude Code local transcript reading is **off by default**. Even calling the MCP tool is not enough: the process must also be started with:

```bash
AGENT_DEBUGGER_CLAUDE_LOCAL=enabled npm run mcp
```

That flag is a local switch, not a credential. No token, account, or secret is introduced.

### Required tool arguments

```json
{
  "name": "read_claude_local_usage",
  "arguments": {
    "path": "/absolute/path/to/claude-transcript.jsonl",
    "allowedRoots": ["/absolute/path/to/allowed-directory"],
    "consentGranted": true,
    "acknowledgedScope": true,
    "traceId": "optional-local-trace-id",
    "maxRecords": 500
  }
}
```

All of the following are enforced:

- `AGENT_DEBUGGER_CLAUDE_LOCAL=enabled` for the process
- `consentGranted: true` and `acknowledgedScope: true` in the request
- At least one absolute `allowedRoots` entry pointing to an existing directory
- The target must be an absolute `.jsonl` path inside an allowed root
- Both the supplied path and its `realpath` must be inside an allowed root, so a symlink cannot escape the allowlist
- File size is capped at 10 MB and records at 5,000 (default 500)
- Strict redaction runs before any usage normalization

### What the adapter returns

The adapter returns only:

- allowlisted usage fields: token buckets, provider, model, request id, trace id, confidence, consent
- one strict redaction receipt with detector counts and skipped-field counts
- record counters and warnings

It never returns transcript text, the source path, raw JSON lines, prompts, tool arguments, or redacted values. Entries are labelled `reported` and `consent: "granted"` only because the caller explicitly opted in. They are not inferred from browser state. claude.ai Web remains manual-export only; no scraping, automation, or credential use is implemented.

## Trust model

- MCP calls operate on the local store only.
- `import_trace` and `record_usage` are explicitly mutating tools; they do not call out to any service.
- Tool errors are returned as MCP tool results with `isError: true`; protocol errors use JSON-RPC error codes.
- The server logs neither request bodies nor transcript content.
- The fingerprint on a Cause Package detects accidental edits; it is not a signature.

## Verification

```bash
npm run verify
```

The MCP tests cover initialization, tool discovery, analysis, comparison, package export, error responses, redaction of a synthetic secret, consent enforcement, path allowlisting, symlink containment, relative and nonexistent root rejection, and the process-level opt-in switch. Symlink creation tests are skipped only on platforms where the local process is not permitted to create symlinks. See `docs/SECURITY_REVIEW.md` for the security disposition.
