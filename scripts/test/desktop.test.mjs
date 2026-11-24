import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { createDesktopStaticServer, getFreePort } from "../lib/localServer.mjs"

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function run() {
  const temp = mkdtempSync(path.join(os.tmpdir(), "ad-desktop-test-"))
  const distDir = path.join(temp, "dist")
  const outside = path.join(temp, "outside.txt")
  const apiPort = await getFreePort()
  const uiPort = await getFreePort()
  writeFileSync(outside, "outside secret", "utf8")

  const { mkdirSync } = await import("node:fs")
  mkdirSync(distDir, { recursive: true })
  writeFileSync(
    path.join(distDir, "index.html"),
    "<!doctype html><title>shell</title>",
    "utf8",
  )
  writeFileSync(path.join(distDir, "app.js"), "console.log('ok')\n", "utf8")

  const api = http.createServer((request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8")
    response.end(JSON.stringify({ ok: true, method: request.method, url: request.url }))
  })
  await new Promise((resolve, reject) => {
    api.once("error", reject)
    api.listen(apiPort, "127.0.0.1", resolve)
  })

  const ui = createDesktopStaticServer({
    distDir,
    apiBase: `http://127.0.0.1:${apiPort}`,
  })
  await new Promise((resolve, reject) => {
    ui.once("error", reject)
    ui.listen(uiPort, "127.0.0.1", resolve)
  })

  const base = `http://127.0.0.1:${uiPort}`
  try {
    const index = await fetch(`${base}/`)
    assert.equal(index.status, 200)
    assert.match(index.headers.get("content-type") ?? "", /text\/html/)
    assert.match(await index.text(), /shell/)

    const asset = await fetch(`${base}/app.js`)
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get("content-type") ?? "", /javascript/)
    assert.match(await asset.text(), /console\.log/)

    const fallback = await fetch(`${base}/traces/does-not-exist`)
    assert.equal(fallback.status, 200)
    assert.match(await fallback.text(), /shell/)

    const proxied = await fetch(`${base}/api/health`).then((response) => response.json())
    assert.deepEqual(proxied, { ok: true, method: "GET", url: "/api/health" })

    const posted = await fetch(`${base}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "probe" }),
    }).then((response) => response.json())
    assert.equal(posted.method, "POST")
    assert.equal(posted.url, "/api/events")

    const traversal = await fetch(`${base}/%2e%2e%2foutside.txt`)
    const traversalText = await traversal.text()
    assert.equal(traversalText.includes("outside secret"), false)

    console.log("desktop shell tests ok")
  } finally {
    await closeServer(ui)
    await closeServer(api)
    rmSync(temp, { force: true, recursive: true })
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
