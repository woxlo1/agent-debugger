# Validation session script

## Before the session

1. Confirm the participant has signed the consent form in `consent-template.md`.
2. Confirm the trace is already redacted and has a local alias, not a customer or real name.
3. Confirm the third-party ground-truth owner has fixed the expected cause before the participant sees the trace.
4. Prepare the balanced order: half of the sessions start with Cause Package view, half with raw trace view.
5. Start the local API with a temporary store:

```bash
AGENT_DEBUGGER_STORE=/absolute/path/to/study-events.ndjson npm run dev
```

## During the session

Read this aloud:

> This is not a test of you. We are testing the tool. Think aloud. You may stop at any time.

Then run the following steps without coaching the participant toward the tool's answer:

| Step | Action | Record |
|---|---|---|
| 1 | Open the assigned view for trace A. Start the timer. | Start time |
| 2 | Ask: "What do you think caused this failure?" | Time to first plausible cause, verbatim answer |
| 3 | Ask: "What would you inspect or replay next?" | Next action, file/tool/breakpoint target |
| 4 | Ask the participant to rate confidence from 0–100. | Confidence number |
| 5 | Stop the timer. | End time |
| 6 | Repeat with trace B using the opposite view order. | Same fields |
| 7 | Ask which view made the next action clearer and why. | Anonymous qualitative note |

Do not reveal ground truth until both traces are scored.

## After the session

1. Compare answers with the pre-registered third-party ground truth.
2. Mark each answer as `matches`, `partial`, or `does not match`.
3. Mark each reproduction step as `followable`, `unclear`, or `not followable`.
4. Enter results in `results-sheet.md`.
5. Delete the temporary study store after the analysis is recorded.

## Labeling rule

A synthetic rehearsal is always labelled `procedure ok / not evaluable`. It never counts toward H1.
