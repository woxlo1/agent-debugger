#!/usr/bin/env node
// Minimal CLI. "agent-debugger start" boots the local server.
// "agent-debugger pipe" reads JSON Lines from stdin/file and forwards them
// to the server, so any language can send traces without an SDK.
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { runPipe } from "./pipe.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const command = process.argv[2] ?? "start"

if (command === "pipe") {
  const filePath = process.argv[3]
  await runPipe(filePath)
  process.exit(0)
}

if (command !== "start") {
  console.log("Usage:")
  console.log("  agent-debugger start            Start the local server + UI backend")
  console.log("  agent-debugger pipe [file]       Send JSON Lines events from stdin or a file")
  process.exit(1)
}

const serverEntry = path.join(__dirname, "..", "src", "index.ts")

const child = spawn(
  process.execPath,
  [path.join(__dirname, "..", "node_modules", ".bin", "tsx"), serverEntry],
  { stdio: "inherit", env: process.env }
)

child.on("exit", (code) => process.exit(code ?? 0))
