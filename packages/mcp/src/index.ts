import { findTool, tools } from "./tools.js"

const SERVER_NAME = "agent-debugger-mcp"
const SERVER_VERSION = "1.0.0"
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0]

type JsonRpcId = number | string | null
type JsonRpcRequest = {
  jsonrpc: "2.0"
  id?: JsonRpcId
  method: string
  params?: Record<string, unknown>
}

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function sendResult(id: JsonRpcId, result: unknown): void {
  send({ jsonrpc: "2.0", id, result })
}

function sendError(id: JsonRpcId, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function handleRequest(request: JsonRpcRequest): void {
  const id = request.id ?? null
  const params = isRecord(request.params) ? request.params : {}

  if (request.method === "initialize") {
    const requested =
      typeof params.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL_VERSION
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
      ? requested
      : DEFAULT_PROTOCOL_VERSION
    sendResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        "All tools read local data only. No external AI service, network request, credential, or upload is used. Claude local transcript reading is disabled unless explicitly enabled and consented.",
    })
    return
  }

  if (request.method === "notifications/initialized" || request.method === "initialized") {
    return
  }

  if (request.method === "ping") {
    sendResult(id, {})
    return
  }

  if (request.method === "tools/list") {
    sendResult(id, {
      tools: tools.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    })
    return
  }

  if (request.method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : ""
    const tool = findTool(name)
    if (!tool) {
      sendResult(id, {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      })
      return
    }
    const args = isRecord(params.arguments) ? params.arguments : {}
    try {
      const value = tool.handler(args)
      sendResult(id, {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        isError: false,
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      sendResult(id, {
        content: [{ type: "text", text: message }],
        isError: true,
      })
    }
    return
  }

  sendError(id, -32601, `Method not found: ${request.method}`)
}

function handleLine(line: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    sendError(null, -32700, "Parse error")
    return
  }
  if (
    !isRecord(parsed) ||
    parsed.jsonrpc !== "2.0" ||
    typeof parsed.method !== "string" ||
    (parsed.id !== undefined &&
      typeof parsed.id !== "number" &&
      typeof parsed.id !== "string" &&
      parsed.id !== null)
  ) {
    sendError(null, -32600, "Invalid Request")
    return
  }
  handleRequest(parsed as unknown as JsonRpcRequest)
}

let buffer = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  buffer += chunk
  let newline = buffer.indexOf("\n")
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line) handleLine(line)
    newline = buffer.indexOf("\n")
  }
})
process.stdin.on("end", () => {
  const line = buffer.trim()
  if (line) handleLine(line)
  buffer = ""
})
