// packages/sdk/src/llmWrapper.ts
import { countTokensInMessagesFallback, countTokensFallback, logTokenUsage } from "./tokenUsage";

type Message = { role: string; content: string };

type CallFn = (messages: Message[]) => Promise<any>;

export async function callWithInstrumentation(opts: {
  agentId?: string;
  model?: string;
  messages: Message[];
  call: CallFn; // function that performs the actual LLM request
  redact?: boolean; // future: redact sensitive fields before logging
}) {
  const { agentId = "unknown", model = "unknown", messages, call, redact = false } = opts;

  // Count input tokens (fallback)
  const inputTokens = countTokensInMessagesFallback(messages);

  const start = Date.now();
  const response = await call(messages);
  const durationMs = Date.now() - start;

  // Try to infer output token usage from response. If response.usage.total_tokens exists, use it.
  let outputTokens = 0;
  try {
    if (response && typeof response === "object") {
      // OpenAI-style usage
      if (response.usage && typeof response.usage.total_tokens === "number") {
        outputTokens = response.usage.total_tokens - (response.usage.prompt_tokens || 0);
      } else if (response.choices && Array.isArray(response.choices)) {
        // Sum lengths of text in choices
        for (const c of response.choices) {
          if (typeof c.text === "string") outputTokens += countTokensFallback(c.text);
          if (c.message && typeof c.message.content === "string") outputTokens += countTokensFallback(c.message.content);
        }
      } else if (typeof response === "string") {
        outputTokens = countTokensFallback(response as string);
      } else if (response.data && Array.isArray(response.data)) {
        // some APIs return data array with text
        for (const d of response.data) {
          if (d && typeof d.text === "string") outputTokens += countTokensFallback(d.text);
        }
      }
    }
  } catch (err) {
    // best-effort
    console.warn("Failed to infer output token count:", err);
  }

  const totalTokens = inputTokens + outputTokens;
  const requestId = (response && (response.id || response.request_id)) || `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  const entry = {
    ts: new Date().toISOString(),
    agentId,
    model,
    requestId,
    inputTokens,
    outputTokens,
    totalTokens,
    durationMs,
    note: redact ? "redacted" : undefined,
  } as Record<string, any>;

  // Log asynchronously (best-effort)
  try {
    logTokenUsage(entry);
  } catch (err) {
    console.error("Failed to log token usage:", err);
  }

  return response;
}
