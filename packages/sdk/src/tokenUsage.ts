// packages/sdk/src/tokenUsage.ts
import fs from "fs";

// Lightweight fallback tokenizer: counts words as tokens (very rough). Use tiktoken if available for accuracy.
export function countTokensFallback(text: string): number {
  if (!text) return 0;
  // Split on whitespace/punctuation as a simple heuristic
  return text.trim().split(/\s+/).length;
}

export function countTokensInMessagesFallback(messages: Array<{ role: string; content: string }>): number {
  let total = 0;
  for (const m of messages) {
    total += countTokensFallback(m.content);
  }
  return total;
}

// JSONL logger
const LOG_PATH = "logs/token-usage.log";

export function logTokenUsage(entry: Record<string, any>) {
  try {
    fs.mkdirSync("logs", { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (err) {
    // best-effort logging
    console.error("Failed to write token usage log:", err);
  }
}
