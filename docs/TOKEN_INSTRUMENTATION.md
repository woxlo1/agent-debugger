# TOKEN INSTRUMENTATION

This document explains a lightweight token usage instrumentation added to the SDK to help you track where and how many tokens are consumed by agents at runtime.

Goals
- Make it possible to see which agents/models/requests consume the most tokens.
- Provide a simple JSONL log that can be aggregated for cost analysis and debugging.

What was added
- packages/sdk/src/tokenUsage.ts: a fallback token counter (word-based) and a JSONL logger.
- packages/sdk/src/llmWrapper.ts: a wrapper function `callWithInstrumentation` that counts input tokens, calls the underlying LLM client (provided as a function), infers output tokens from the response, and appends a JSONL entry to `logs/token-usage.log`.

How to use
1. Wrap your LLM calls with the helper. Example:

```ts
import { callWithInstrumentation } from "agent-debugger-sdk/src/llmWrapper";

// example wrapper usage
const resp = await callWithInstrumentation({
  agentId: "example-agent",
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Write a short poem about rivers." }
  ],
  call: async (messages) => {
    // call your existing client here and return its response
    return await openaiClient.chat.completions.create({ messages });
  }
});
```

2. Inspect logs
- Logs are appended to `logs/token-usage.log` in JSONL format. Each line contains: `ts`, `agentId`, `model`, `requestId`, `inputTokens`, `outputTokens`, `totalTokens`, `durationMs`.

Notes and next steps
- Current token counting is a simple fallback (word-based). For more accurate counts, integrate `tiktoken` or another tokenizer and update `tokenUsage.ts`.
- The wrapper infers output tokens from several common response shapes (OpenAI-style `usage`, `choices`, string responses). It is best-effort and may under/over-count depending on the API.
- Logs may contain prompt text if you change the instrumentation to include it; avoid logging secrets. Consider adding redaction.
- Future: add a simple dashboard or aggregation script to summarize token usage per-agent/model over time.
