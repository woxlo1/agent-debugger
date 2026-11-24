// Minimal ambient declarations so the server typechecks without pulling in
// @types/node. Replace with @types/node when dependencies are next updated.
declare module "node:crypto" {
  export function randomUUID(): string
}

declare module "node:fs" {
  export function existsSync(path: string): boolean
  export function readFileSync(path: string, encoding: string): string
  export function writeFileSync(path: string, data: string): void
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
  export function createReadStream(path: string): unknown
}

declare module "node:path" {
  export function join(...parts: string[]): string
  export function dirname(path: string): string
}

declare const process: {
  env: Record<string, string | undefined>
  cwd(): string
}
