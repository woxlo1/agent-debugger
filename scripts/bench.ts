import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { gzipSync } from "node:zlib"
import { getFreePort } from "./lib/localServer.mjs"
import { buildCausePackage } from "../packages/artifact/src/index.js"
import { analyzeTrace } from "../packages/server/src/analyzer.js"
import { importTrace } from "../packages/server/src/importer.js"
import { redact } from "../packages/server/src/schema.js"
import { auditPrivacy } from "../packages/server/src/usage.js"
import { buildUsageLedger } from "../packages/usage/src/index.js"

const EVENT_COUNT = 10_000
const root = process.cwd()
const writeResults = process.argv.includes("--write")

type Result = {
  generatedAt: string
  environment: {
    node: string
    platform: string
    arch: string
    cpuModel: string
    logicalCpus: number
    totalMemoryGb: number
  }
  dataset: {
    kind: "synthetic"
    eventCount: number
    description: string
  }
  targets: Record<string, string>
  measurements: Record<string, number>
  pass: Record<string, boolean>
  notes: string[]
}

function now(): number {
  return Number(process.hrtime.bigint()) / 1_000_000
}

function makeNdjson(count: number): string {
  const traceId = `bench-${count}`
  const lines: string[] = []
  for (let index = 0; index < count; index += 1) {
    const step = index % 10
    const event = {
      schemaVersion: 2,
      id: `bench-event-${index}`,
      traceId,
      type: step === 1 || step === 6 ? "reasoning" : step === 9 ? "agent" : "tool",
      name: step === 0 || step === 2 ? "lookup" : step === 3 ? "charge" : "transform",
      status: step === 3 ? "error" : "ok",
      input: { index, bucket: index % 17, text: `synthetic input ${index}` },
      output:
        step === 3
          ? { success: false, error: "declined" }
          : { success: true, value: index % 101 },
      timestamp: index + 1,
      durationMs: index % 97 === 0 ? 9000 : 12 + (index % 40),
      source: { path: `src/bench/step-${step}.ts`, line: index + 1 },
      attributes: { synthetic: true, phase: `phase-${Math.floor(index / 100)}` },
    }
    lines.push(JSON.stringify(event))
  }
  return lines.join("\n")
}

async function measureColdStart(): Promise<number> {
  const temp = mkdtempSync(path.join(os.tmpdir(), "ad-bench-"))
  const storePath = path.join(temp, "events.ndjson")
  const port = await getFreePort()
  const base = `http://127.0.0.1:${port}`
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "packages/server/src/index.ts"],
    {
      cwd: root,
      stdio: "ignore",
      env: {
        ...process.env,
        AGENT_DEBUGGER_HOST: "127.0.0.1",
        AGENT_DEBUGGER_PORT: String(port),
        AGENT_DEBUGGER_STORE: storePath,
        AGENT_DEBUGGER_TOKEN: "",
      },
    },
  )
  const started = now()
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const response = await fetch(`${base}/api/health`)
        if (response.ok) return Math.round((now() - started) * 100) / 100
      } catch {
        // Process is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    throw new Error("Benchmark server did not become ready")
  } finally {
    child.kill()
    rmSync(temp, { force: true, recursive: true })
  }
}

function measureWebGzipKb(): number {
  const assetsDir = path.join(root, "packages", "web", "dist", "assets")
  const files = readdirSync(assetsDir).filter(
    (name) => name.endsWith(".js") || name.endsWith(".css"),
  )
  const total = files.reduce((sum, name) => {
    const bytes = readFileSync(path.join(assetsDir, name))
    return sum + gzipSync(bytes, { level: 9 }).byteLength
  }, 0)
  return Math.round((total / 1024) * 100) / 100
}

function formatMb(value: number): string {
  return `${value.toFixed(1)} MB`
}

function renderMarkdown(result: Result): string {
  const rows = Object.keys(result.targets)
    .map((key) => {
      const target = result.targets[key]
      const measured = result.measurements[key]
      const value = key === "webGzipKb" ? `${measured} kB` : `${measured} ms`
      if (key === "maxRssDeltaMb") {
        return `| Peak process maxRSS delta | ${target} | ${formatMb(measured)} | ${result.pass[key] ? "pass" : "fail"} |`
      }
      return `| ${labelFor(key)} | ${target} | ${value} | ${result.pass[key] ? "pass" : "fail"} |`
    })
    .join("\n")

  return `# Performance Results

## Status

Measured on ${result.generatedAt.slice(0, 10)} with a synthetic ${result.dataset.eventCount.toLocaleString()} event trace. These are local measurements, not user-study evidence.

| Metric | Target | Measured | Result |
|---|---|---|---|
${rows}

## Environment

| Field | Value |
|---|---|
| Node.js | ${result.environment.node} |
| Platform | ${result.environment.platform} (${result.environment.arch}) |
| CPU | ${result.environment.cpuModel} |
| Logical CPUs | ${result.environment.logicalCpus} |
| Total memory | ${result.environment.totalMemoryGb} GB |

## Methodology

- **Cold start**: spawn the API with a temporary store and time until \`/api/health\` returns 200. The first run includes TypeScript transform cost.
- **Import**: parse and normalize a generated NDJSON string with \`importTrace\`, format \`ndjson\`.
- **Analyze**: run the deterministic rule engine over the imported events with \`analyzeTrace\`.
- **Package export**: build a full redacted Cause Package, including fingerprint, with \`buildCausePackage\`.
- **Peak process maxRSS delta**: \`process.resourceUsage().maxRSS\` delta from benchmark start after the in-process operations. This is a process-level proxy, not a per-function heap profile.
- **Web bundle**: sum gzip size at level 9 of the built JS and CSS assets in \`packages/web/dist/assets\`.

The dataset is deterministic and synthetic. It contains repeated tool calls, status errors, missing-like steps, duration outliers, and an unfinished-run shape so the rule engine has representative work. No real trace, prompt, credential, or external response is used.

## Interpretation

- A \`pass\` means the measured value is within the design target on this machine at this time.
- A \`fail\` is recorded honestly. It is not hidden by changing the target.
- Cold start includes the first TypeScript transform through \`tsx\`; if it misses the 500 ms target, that is a known startup gap rather than a measurement error.
- Results are expected to vary with CPU speed, filesystem cache, and Node version.
- These numbers say nothing about whether the Cause Package helps a developer; see \`docs/VALIDATION_PLAN.md\` for that separate, unexecuted plan.

## Reproduce

\`\`\`bash
npm run verify
npm run bench
\`\`\`

\`npm run bench\` rewrites this file and \`docs/benchmark-results.json\`. Do not edit either by hand.
`
}

function labelFor(key: string): string {
  const labels: Record<string, string> = {
    coldStartMs: "Server cold start to `/api/health`",
    importMs: "Import 10,000 NDJSON events",
    analyzeMs: "Analyze a 10,000-event trace",
    packageMs: "Export a Cause Package for 10,000 events",
    webGzipKb: "Web bundle (JS + CSS, gzip)",
  }
  return labels[key] ?? key
}

async function run() {
  const baselineRssKb = process.resourceUsage().maxRSS
  const ndjson = makeNdjson(EVENT_COUNT)

  const importStart = now()
  const imported = importTrace({ content: ndjson, format: "ndjson", traceId: `bench-${EVENT_COUNT}` })
  const importMs = Math.round((now() - importStart) * 100) / 100

  const analyzeStart = now()
  const analysis = analyzeTrace(imported.traceId, imported.events)
  const analyzeMs = Math.round((now() - analyzeStart) * 100) / 100

  const packageStart = now()
  const packageValue = buildCausePackage({
    traceId: imported.traceId,
    events: imported.events,
    analysis,
    usage: buildUsageLedger(imported.traceId, [], { includeEstimates: false }),
    privacy: auditPrivacy([]),
    redactor: redact,
  })
  const packageMs = Math.round((now() - packageStart) * 100) / 100

  const maxRssDeltaMb =
    Math.round(((process.resourceUsage().maxRSS - baselineRssKb) / 1024) * 10) / 10
  const coldStartMs = await measureColdStart()
  const webGzipKb = measureWebGzipKb()

  if (imported.imported !== EVENT_COUNT || packageValue.integrity.eventCount !== EVENT_COUNT) {
    throw new Error("Benchmark dataset was not fully imported or packaged")
  }

  const measurements = {
    coldStartMs,
    importMs,
    analyzeMs,
    packageMs,
    maxRssDeltaMb,
    webGzipKb,
  }
  const targets: Record<string, string> = {
    coldStartMs: "< 500 ms",
    importMs: "< 2 s",
    analyzeMs: "< 500 ms",
    packageMs: "< 1 s",
    maxRssDeltaMb: "< 150 MB",
    webGzipKb: "< 60 kB",
  }
  const limits: Record<string, number> = {
    coldStartMs: 500,
    importMs: 2000,
    analyzeMs: 500,
    packageMs: 1000,
    maxRssDeltaMb: 150,
    webGzipKb: 60,
  }
  const pass = Object.fromEntries(
    Object.entries(measurements).map(([key, value]) => [key, value < limits[key]]),
  )

  const result: Result = {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: os.cpus()[0]?.model ?? "unknown",
      logicalCpus: os.cpus().length,
      totalMemoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    },
    dataset: {
      kind: "synthetic",
      eventCount: EVENT_COUNT,
      description: "Deterministic generated agent trace with representative rule-engine work",
    },
    targets,
    measurements,
    pass,
    notes: [
      "No external service or real trace is used.",
      "maxRssDeltaMb is a process-level proxy, not a per-function heap profile.",
    ],
  }

  console.log(JSON.stringify(result, null, 2))
  if (writeResults) {
    writeFileSync(
      path.join(root, "docs", "benchmark-results.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    )
    writeFileSync(path.join(root, "docs", "PERFORMANCE.md"), renderMarkdown(result), "utf8")
    console.log("Wrote docs/benchmark-results.json and docs/PERFORMANCE.md")
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
