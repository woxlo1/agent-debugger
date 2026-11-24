# Desktop Shell

## What it is

The desktop shell is a dependency-free launcher that starts the local API, serves the built web UI from the same loopback origin, and opens it in the default browser:

```bash
npm run desktop
```

It is a **browser-based desktop shell**, not an Electron or Tauri application. It adds no package dependency and no native binary. The web UI also includes a web app manifest so a browser can install the windowed view where supported.

## Startup sequence

1. Build `packages/web/dist` once if it is missing.
2. Ask the OS for two free loopback ports.
3. Start `packages/server/src/index.ts` with `AGENT_DEBUGGER_HOST=127.0.0.1`.
4. Wait for `/api/health`.
5. Serve `packages/web/dist` from the second loopback port.
6. Proxy `/api/*` requests from the UI to the API port.
7. Open the UI URL in the local default browser.
8. Stop both processes on Ctrl+C or when the API exits.

The two-process split keeps the existing API unchanged. The UI continues to call relative `/api/*` URLs, so no build-time environment variable is needed.

## Security properties

- Both the API and the shell bind to `127.0.0.1` only.
- Static paths are validated against the `dist` directory; encoded traversal attempts fall back to `index.html`.
- Static responses use `Cache-Control: no-store`.
- Proxy hop-by-hop headers are not forwarded.
- No external network request, account, credential, or upload is introduced.
- The launcher does not set `AGENT_DEBUGGER_TOKEN`. If you set one in your environment, note that the current web UI does not send that header, so mutating UI actions will be rejected by design.

## Files

| File | Purpose |
|---|---|
| `scripts/desktop.mjs` | Launcher, browser open, lifecycle, and cleanup |
| `scripts/lib/localServer.mjs` | Loopback static server and `/api` proxy |
| `packages/web/public/manifest.webmanifest` | Installable web app metadata |
| `packages/web/public/icon.svg` | Installable app icon |

## Limitations

- The shell depends on a locally installed browser.
- `xdg-open` is required on Linux; if unavailable, the URL is printed to the terminal.
- It does not implement native window menus, system tray integration, auto-update, or OS keychain storage.
- It does not attach to, pause, inspect, or modify a running agent. The debugger handoff remains a suggestion for your existing debugger.

## Verification

`node scripts/test/desktop.test.mjs` checks static serving, SPA fallback, `/api` proxying for GET and POST, and traversal containment. It is included in `npm run verify`.
