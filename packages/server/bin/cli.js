#!/usr/bin/env node
// Minimal CLI. "agent-debugger start" just boots the same server used in
// dev mode. Kept intentionally tiny for the MVP.
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const command = process.argv[2] ?? "start"

if (command !== "start") {
  console.log("Usage: agent-debugger start")
  process.exit(1)
}

const serverEntry = path.join(__dirname, "..", "src", "index.ts")

const child = spawn(
  process.execPath,
  [path.join(__dirname, "..", "node_modules", ".bin", "tsx"), serverEntry],
  { stdio: "inherit", env: process.env }
)

child.on("exit", (code) => process.exit(code ?? 0))
