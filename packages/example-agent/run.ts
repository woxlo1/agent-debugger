// Demo "agent" that emits a realistic-looking trace using agent-debugger-sdk.
// Run with: npm run demo  (from repo root, requires the server to be running)
import { trace, setTraceId } from "agent-debugger-sdk"

const traceId = `demo-${Date.now()}`
setTraceId(traceId)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`Emitting demo trace: ${traceId}`)

  await trace({
    type: "user",
    name: "user_input",
    input: "What's the weather in Tokyo and should I bring an umbrella?",
  })
  await sleep(300)

  await trace({
    type: "reasoning",
    name: "plan",
    output:
      "I need current weather data for Tokyo. I'll call the weather tool, then reason about precipitation.",
    tokens: 42,
  })
  await sleep(300)

  await trace({
    type: "tool",
    name: "get_weather",
    input: { city: "Tokyo" },
    output: { tempC: 23, condition: "light rain", precipitationChance: 0.8 },
  })
  await sleep(400)

  await trace({
    type: "reasoning",
    name: "interpret_result",
    input: { precipitationChance: 0.8 },
    output: "80% chance of rain, definitely recommend an umbrella.",
    tokens: 18,
  })
  await sleep(300)

  await trace({
    type: "agent",
    name: "final_answer",
    output:
      "It's 23°C with light rain in Tokyo today, 80% chance of precipitation — yes, bring an umbrella!",
    tokens: 28,
    cost: 0.0007,
  })

  console.log("Done. Open the UI at http://localhost:5173 and select this trace.")
}

main()
