# agent-debugger-sdk

Minimal TypeScript client for sending agent events to a local
[agent-debugger](https://github.com/woxlo1/agent-debugger) server.

```ts
import { setTraceId, trace } from "agent-debugger-sdk"

setTraceId("checkout-agent-run-42")
await trace({ type: "tool", name: "charge_card", status: "error" })
```

`trace()` never throws; it returns `{ ok, event, error }`. Use `traceOrThrow()`
when delivery failure must stop the run.

## License

MIT
