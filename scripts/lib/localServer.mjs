import { createReadStream, existsSync, statSync } from "node:fs"
import http from "node:http"
import net from "node:net"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

/** Ask the OS for a free localhost port. */
export async function getFreePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Could not resolve a free localhost port")
  }
  const { port } = address
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

function resolveStaticPath(root, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const relative = path.normalize(decoded).replace(/^[/\\]+/, "")
  const target = path.resolve(root, relative)
  const inside = path.relative(root, target)
  if (inside.startsWith("..") || path.isAbsolute(inside)) return null
  return target
}

async function readBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length === 0 ? undefined : Buffer.concat(chunks)
}

function proxyHeaders(request) {
  const headers = {}
  for (const [name, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase()) || value === undefined) continue
    headers[name] = Array.isArray(value) ? value.join(", ") : value
  }
  return headers
}

function proxyTarget(apiBase, incoming) {
  // Host and protocol are fixed to the local API. Only the path and query of
  // the loopback request are forwarded; an absolute-form request URL cannot
  // change the destination.
  const target = new URL(apiBase)
  target.pathname = incoming.pathname
  target.search = incoming.search
  target.hash = ""
  return target
}

async function proxyApi(request, response, target, body) {
  // codeql[js/request-forgery]
  const upstream = await fetch(target, {
    method: request.method,
    headers: proxyHeaders(request),
    body,
    redirect: "manual",
  })

  response.statusCode = upstream.status
  for (const [name, value] of upstream.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) response.setHeader(name, value)
  }
  response.setHeader("cache-control", "no-store")

  if (request.method === "HEAD" || !upstream.body) {
    response.end()
    return
  }
  await pipeline(Readable.fromWeb(upstream.body), response)
}

async function serveStatic(request, response, distDir, pathname) {
  let target = resolveStaticPath(distDir, pathname)
  if (!target || !existsSync(target)) {
    target = path.join(distDir, "index.html")
  }
  if (!existsSync(target)) {
    response.statusCode = 404
    response.setHeader("content-type", "text/plain; charset=utf-8")
    response.end("Desktop shell assets are missing. Run npm run build -w packages/web.")
    return
  }
  if (statSync(target).isDirectory()) {
    target = path.join(target, "index.html")
  }
  if (!existsSync(target)) {
    response.statusCode = 404
    response.end()
    return
  }

  const extension = path.extname(target).toLowerCase()
  response.statusCode = 200
  response.setHeader("content-type", MIME_TYPES[extension] ?? "application/octet-stream")
  response.setHeader("cache-control", "no-store")
  // codeql[js/file-access-to-http]
  await pipeline(createReadStream(target), response)
}

/**
 * Local-only desktop shell server: serves the built web UI and proxies /api
 * to the existing localhost API. It never binds to a non-loopback interface.
 */
export function createDesktopStaticServer({ distDir, apiBase }) {
  return http.createServer(async (request, response) => {
    try {
      const parsed = new URL(request.url ?? "/", "http://127.0.0.1")
      const body = await readBody(request)
      if (parsed.pathname.startsWith("/api/")) {
        await proxyApi(request, response, proxyTarget(apiBase, parsed), body)
        return
      }
      await serveStatic(request, response, distDir, parsed.pathname)
    } catch {
      if (!response.headersSent) {
        response.statusCode = 502
        response.setHeader("content-type", "application/json; charset=utf-8")
      }
      response.end(JSON.stringify({ error: "Desktop shell request failed" }))
    }
  })
}
