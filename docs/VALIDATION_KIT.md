# Validation Kit

## Status

The study materials are ready. The study itself has **not** been executed. There are no participants, no consented real traces, and no ground-truth results in this repository.

This kit supports `docs/VALIDATION_PLAN.md`. It does not create evidence for H1 by itself.

## Files

| File | Purpose |
|---|---|
| `docs/validation/consent-template.md` | Consent text for trace owners |
| `docs/validation/session-script.md` | Balanced, timed session procedure |
| `docs/validation/results-sheet.md` | Anonymous coded results and decision log |

## Prerequisites

Do not start a session until all of these are true:

- 6–8 target-user participants are recruited.
- At least 6 consented, pre-redacted real failed traces are available under local aliases.
- One third-party ground-truth owner has fixed expected causes before participants see the traces.
- One or more authors have prepared manual Cause Packages.
- Signed consent records are stored outside the repository.

## Synthetic rehearsal

A procedure rehearsal may use `docs/examples/failed-trace.ndjson` only:

```bash
AGENT_DEBUGGER_STORE=/absolute/path/to/rehearsal-events.ndjson npm run dev
npm run demo
```

Open the UI, confirm the Cause Package sections render, export NDJSON, and confirm values remain redacted. Record the outcome as `procedure ok / not evaluable`. Never count it toward H1.

## What this kit deliberately does not contain

- Real participant data
- Real customer traces
- Ground-truth answers
- Timing or success claims
- External survey or analytics integration
