// Minimal ambient declarations so the MCP package typechecks without adding
// @types/node. These mirror only the APIs used by this package and the local
// modules it imports.

declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: "hex"): string }
  }
  export function randomUUID(): string
}

declare module "node:fs" {
  export function existsSync(path: string): boolean
  export function readFileSync(path: string, encoding: string): string
  export function writeFileSync(path: string, data: string): void
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
  export function realpathSync(path: string): string
  export function statSync(path: string): {
    size: number
    isFile(): boolean
    isDirectory(): boolean
  }
}

declare module "node:path" {
  export function join(...parts: string[]): string
  export function resolve(...parts: string[]): string
  export function relative(from: string, to: string): string
  export function isAbsolute(path: string): boolean
  export function basename(path: string): string
  export function dirname(path: string): string
}

declare const process: {
  env: Record<string, string | undefined>
  cwd(): string
  stdin: {
    setEncoding(encoding: string): void
    on(event: "data", listener: (chunk: string) => void): void
    on(event: "end", listener: () => void): void
  }
  stdout: {
    write(chunk: string): void
  }
  stderr: {
    write(chunk: string): void
  }
}
