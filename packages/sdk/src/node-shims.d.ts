// Minimal ambient declarations so the SDK typechecks without @types/node.
declare module "node:crypto" {
  export function randomUUID(): string
}

declare const process: {
  env: Record<string, string | undefined>
}
