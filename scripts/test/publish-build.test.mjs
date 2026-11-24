import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const fromRoot = (...segments) => path.join(root, ...segments)

const requiredFiles = [
  "packages/sdk/dist/index.js",
  "packages/sdk/dist/index.d.ts",
  "packages/server/dist/packages/server/src/index.js",
  "packages/server/dist/packages/shared/src/index.js",
  "packages/server/dist/packages/usage/src/index.js",
  "packages/server/dist/packages/artifact/src/index.js",
  "packages/server/dist/packages/cases/src/index.js",
  "packages/server/dist/packages/ingest/src/adapters/index.js",
  "packages/server/dist/packages/privacy/src/index.js",
]

for (const file of requiredFiles) {
  assert.equal(existsSync(fromRoot(file)), true, `missing publish artifact: ${file}`)
}

const sdkPackage = JSON.parse(readFileSync(fromRoot("packages/sdk/package.json"), "utf8"))
assert.equal(sdkPackage.scripts.prepack, "npm run build")
assert.ok(sdkPackage.files.includes("dist"))

const serverPackage = JSON.parse(readFileSync(fromRoot("packages/server/package.json"), "utf8"))
assert.equal(serverPackage.scripts.prepack, "npm run build")
assert.ok(serverPackage.files.includes("dist"))
assert.ok(serverPackage.files.includes("bin"))

const cli = readFileSync(fromRoot("packages/server/bin/cli.js"), "utf8")
assert.equal(cli.includes("node_modules/.bin/tsx"), false)
assert.equal(cli.includes("src/index.ts"), false)
for (const segment of ["dist", "packages", "server", "src", "index.js"]) {
  assert.ok(cli.includes(`"${segment}"`), `CLI is missing compiled entry segment: ${segment}`)
}

console.log("publish build tests ok")
