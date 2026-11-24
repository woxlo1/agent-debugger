# Performance Results

## Status

Measured on 2026-11-24 with a synthetic 10,000 event trace. These are local measurements, not user-study evidence.

| Metric | Target | Measured | Result |
|---|---|---|---|
| Server cold start to `/api/health` | < 500 ms | 683.01 ms | fail |
| Import 10,000 NDJSON events | < 2 s | 46.19 ms | pass |
| Analyze a 10,000-event trace | < 500 ms | 12.34 ms | pass |
| Export a Cause Package for 10,000 events | < 1 s | 102.86 ms | pass |
| Peak process maxRSS delta | < 150 MB | 96.7 MB | pass |
| Web bundle (JS + CSS, gzip) | < 60 kB | 53.33 kB | pass |

## Environment

| Field | Value |
|---|---|
| Node.js | v24.13.1 |
| Platform | win32 (x64) |
| CPU | 12th Gen Intel(R) Core(TM) i7-12700K |
| Logical CPUs | 20 |
| Total memory | 31.8 GB |

## Methodology

- **Cold start**: spawn the API with a temporary store and time until `/api/health` returns 200. The first run includes TypeScript transform cost.
- **Import**: parse and normalize a generated NDJSON string with `importTrace`, format `ndjson`.
- **Analyze**: run the deterministic rule engine over the imported events with `analyzeTrace`.
- **Package export**: build a full redacted Cause Package, including fingerprint, with `buildCausePackage`.
- **Peak process maxRSS delta**: `process.resourceUsage().maxRSS` delta from benchmark start after the in-process operations. This is a process-level proxy, not a per-function heap profile.
- **Web bundle**: sum gzip size at level 9 of the built JS and CSS assets in `packages/web/dist/assets`.

The dataset is deterministic and synthetic. It contains repeated tool calls, status errors, missing-like steps, duration outliers, and an unfinished-run shape so the rule engine has representative work. No real trace, prompt, credential, or external response is used.

## Interpretation

- A `pass` means the measured value is within the design target on this machine at this time.
- A `fail` is recorded honestly. It is not hidden by changing the target.
- Cold start includes the first TypeScript transform through `tsx`; if it misses the 500 ms target, that is a known startup gap rather than a measurement error.
- Results are expected to vary with CPU speed, filesystem cache, and Node version.
- These numbers say nothing about whether the Cause Package helps a developer; see `docs/VALIDATION_PLAN.md` for that separate, unexecuted plan.

## Reproduce

```bash
npm run verify
npm run bench
```

`npm run bench` rewrites this file and `docs/benchmark-results.json`. Do not edit either by hand.
