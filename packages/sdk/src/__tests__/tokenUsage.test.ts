// packages/sdk/src/__tests__/tokenUsage.test.ts
import { countTokensFallback, countTokensInMessagesFallback } from "../tokenUsage";

function expectEqual(a: number, b: number) {
  if (a !== b) throw new Error(`Expected ${a} === ${b}`);
}

// Simple unit tests (no test runner required for smoke testing)
(function runTests() {
  // Test basic token counting
  const text = "Hello world, this is a test.";
  const tokens = countTokensFallback(text);
  expectEqual(tokens, 6); // Hello, world, this, is, a, test.

  const messages = [
    { role: "user", content: "Hello world" },
    { role: "assistant", content: "Hi there" }
  ];
  const mTokens = countTokensInMessagesFallback(messages);
  expectEqual(mTokens, 4);

  console.log("tokenUsage tests passed");
})();
