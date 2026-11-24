# Contributing

Thanks for helping improve Agent Debugger.

## Scope

This project currently focuses on:

- trace import and normalization
- the versioned event schema
- deterministic, rule-based evidence extraction
- handoff to debuggers you already use

The following are intentionally out of scope for now: live pause/inject, eval systems, cloud services, and a custom DAP implementation.

## Setup

```bash
git clone https://github.com/woxlo1/agent-debugger.git
cd agent-debugger
npm install
npm run dev
```

## Before opening a pull request

Run:

```bash
node --check packages/server/bin/pipe.js
node --check packages/server/bin/cli.js
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/sdk/tsconfig.json
npm run build -w packages/web
```

Keep repository artifacts in English.

## Trace data

Never commit raw traces. If a fixture is needed, use synthetic data or a redacted, consented trace. Remove API keys, tokens, emails, customer IDs, internal hostnames, and absolute home paths.

## Pull requests

Keep changes small and describe which rule, schema field, or handoff behavior changed. Use the pull request template.
