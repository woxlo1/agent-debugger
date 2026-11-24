# agent-debugger-server

Local, rule-based Cause Package server and CLI for failed agent traces.
Everything runs on your machine: no account, no cloud, no external AI service.

This package contains the **local API and the `agent-debugger` CLI**. It does
not bundle the web UI. For the UI, clone the repository and run
`npm run dev` or `npm run desktop`:
https://github.com/woxlo1/agent-debugger

## Usage

```bash
npx agent-debugger-server start        # API on http://127.0.0.1:4317
agent-debugger import failed-run.jsonl # import an NDJSON trace
agent-debugger analyze <traceId>       # print the Cause Package as JSON
agent-debugger package <traceId> out.json
agent-debugger compare <traceIdA> <traceIdB>
```

Run `agent-debugger` with no arguments for the full command list.

## License

MIT
