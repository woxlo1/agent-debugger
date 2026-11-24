// Demo agent that emits a failed checkout trace using the local SDK source.
// Run with: npm run demo  (from the repo root, with the local server running)
import { setTraceId, traceOrThrow } from "../../sdk/src/index.ts"

const traceId = `demo-failed-checkout-${Date.now()}`
setTraceId(traceId)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  console.log(`Emitting failed demo trace: ${traceId}`)

  const root = await traceOrThrow({
    type: "user",
    name: "user_request",
    input: "Charge the card and confirm the order",
  })

  await sleep(200)

  const plan = await traceOrThrow({
    type: "reasoning",
    name: "plan",
    parentId: root.id,
    output: "Validate the cart, charge the card, then confirm the order.",
    tokens: 38,
  })

  await sleep(200)

  await traceOrThrow({
    type: "tool",
    name: "validate_cart",
    parentId: plan.id,
    input: { cartId: "cart-42" },
    output: { valid: true },
    status: "ok",
    durationMs: 80,
    source: { path: "src/cart.ts", line: 12 },
  })

  await traceOrThrow({
    type: "tool",
    name: "lookup_inventory",
    parentId: plan.id,
    input: { sku: "SKU-1" },
    output: { inStock: true },
    status: "ok",
    durationMs: 90,
    source: { path: "src/inventory.ts", line: 20 },
  })

  await sleep(300)

  for (let attempt = 1; attempt <= 3; attempt++) {
    await traceOrThrow({
      type: "tool",
      name: "charge_card",
      parentId: plan.id,
      input: { amount: 4200, currency: "JPY" },
      output: { success: false, error: "declined" },
      status: "error",
      error: { kind: "payment", message: "card declined" },
      durationMs: 90 + attempt * 10,
      source: { path: "src/payments.ts", line: 88 },
    })
    await sleep(200)
  }

  await traceOrThrow({
    type: "tool",
    name: "audit_log",
    parentId: plan.id,
    input: { event: "charge_failed" },
    output: { written: true },
    status: "ok",
    durationMs: 1500,
    source: { path: "src/audit.ts", line: 15 },
  })

  await traceOrThrow({
    type: "reasoning",
    name: "retry_plan",
    parentId: plan.id,
    output: "The payment was declined. Retry the same charge with the same arguments and inspect the response.",
    tokens: 29,
  })

  console.log("Done. Open http://localhost:5173 and inspect the Cause Package for this trace.")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
