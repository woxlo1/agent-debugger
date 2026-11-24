import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createDesktopStaticServer, getFreePort } from "./lib/localServer.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(root, "packages", "web", "dist")

function ensureUiBuild() {
  if (existsSync(path.join(distDir, "index.html"))) return
  console.log("[desktop] UI build not found; building packages/web once")
  const npm = process.platform === "win32" ? "npm.cmd" : "npm"
  const result = spawnSync(npm, ["run", "build", "-w", "packages/web"], {
    cwd: root,
    stdio: "inherit",
  })
  if (result.status !== 0) {
    throw new Error("Failed to build the local web UI")
  }
}

async function waitForHealth(apiBase) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/api/health`)
      if (response.ok) return
    } catch {
      // API process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("Local API did not become ready")
}

function openBrowser(url) {
  let child
  if (process.platform === "win32") {
    child = spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true })
  } else if (process.platform === "darwin") {
    child = spawn("open", [url], { stdio: "ignore", detached: true })
  } else {
    child = spawn("xdg-open", [url], { stdio: "ignore", detached: true })
  }
  child.on("error", () => {
    console.log(`[desktop] Could not open a browser automatically. Open ${url}`)
  })
  child.unref()
}

async function main() {
  ensureUiBuild()

  const apiPort = await getFreePort()
  const uiPort = await getFreePort()
  const apiBase = `http://127.0.0.1:${apiPort}`
  const uiUrl = `http://127.0.0.1:${uiPort}`

  const api = spawn(
    process.execPath,
    ["--import", "tsx", "packages/server/src/index.ts"],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        AGENT_DEBUGGER_HOST: "127.0.0.1",
        AGENT_DEBUGGER_PORT: String(apiPort),
      },
    },
  )

  let ui
  let stopping = false
  const stop = (code = 0) => {
    if (stopping) return
    stopping = true
    api.kill()
    if (ui) ui.close(() => process.exit(code))
    else process.exit(code)
  }

  process.on("SIGINT", () => stop(0))
  process.on("SIGTERM", () => stop(0))
  api.on("exit", (code) => {
    if (!stopping) {
      console.error(`[desktop] Local API exited with code ${code ?? 0}`)
      stop(code ?? 0)
    }
  })

  try {
    await waitForHealth(apiBase)

    ui = createDesktopStaticServer({ distDir, apiBase })
    await new Promise((resolve, reject) => {
      ui.once("error", reject)
      ui.listen(uiPort, "127.0.0.1", resolve)
    })

    console.log(`\n  Agent Debugger desktop shell: ${uiUrl}`)
    console.log("  Local API and UI are bound to 127.0.0.1 only.")
    console.log("  Press Ctrl+C to stop.\n")
    openBrowser(uiUrl)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    stop(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
