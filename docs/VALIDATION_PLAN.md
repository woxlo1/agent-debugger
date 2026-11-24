# Validation Plan

## Status

**Not executed. No user results, effect estimates, or validation claims are made.**

Current state as of 2026-11-24:

| Item | Required | Current | Status |
|---|---|---|---|
| Target-user participants | 6–8 | 0 recruited | Blocked |
| Consented, pre-redacted real failed traces | At least 6 | 0 available | Blocked |
| Third-party ground-truth owner | 1 | Not assigned | Blocked |
| Manual Cause Package authors | 1 or more | Not assigned | Blocked |
| Procedure rehearsal | 1 recorded run | Not performed as a recorded study procedure | Not executed |
| H1 hypothesis | Tested | Untested | No decision |

Automated fixture tests exercise import, analysis, and bundle shape. They are **not** a user study and do not count as evidence for H1. Synthetic traces may be used only for procedure rehearsal, and any rehearsal result must be labelled `not evaluable`.

Executing the study requires all blocking conditions below to be satisfied first.

## Hypothesis under test

H1 (product hypothesis, not a confirmed decision):

> A rule-based Cause Package generated from a failed agent trace helps the target developer reach a plausible cause and a concrete next debugging action faster than reading the raw trace alone.

## Design

- Comparison: manual Cause Package view versus raw trace viewing.
- Order is counterbalanced across participants.
- The same trace repeated by the same participant is not counted as an independent observation.
- Ground truth is fixed in advance by a third party who does not author the Cause Packages.
- Timing is reported descriptively at participant level; no population claim is made.
- Qualitative comments inform iteration but are never the sole condition for withdrawing an option.

## Roles required

- 6–8 target-user participants.
- At least 6 consented, pre-redacted real failed traces.
- One third-party ground-truth owner.
- One or more authors for manual Cause Packages.

## Consent and data handling

- Real traces require explicit consent from the trace owner.
- Redaction must be applied before a trace enters the study workspace.
- Synthetic traces may be used only for procedure rehearsal.
- A rehearsal result must be labelled `not evaluable`; it does not count toward H1.
- No trace, prompt, or runtime state is sent to an external service as part of this plan.

## Measures

- Time from opening the trace to naming a plausible cause.
- Agreement with third-party ground truth.
- Whether the proposed reproduction step can be followed.
- Whether the handoff identifies a concrete file, tool, or breakpoint target.
- Confidence calibration against correctness.

## Decision labels (directional only)

- **Advance**: faster cause identification and at least comparable correctness, with usable handoff.
- **Hold**: mixed results; refine the rule set or the user flow before deciding.
- **Withdraw**: the Cause Package does not improve investigation or misleads participants.

These labels guide iteration. They are not proof of product-market fit.

## Procedure rehearsal checklist (synthetic only)

1. Start the local server.
2. Import `docs/examples/failed-trace.ndjson`.
3. Confirm observed evidence, candidates, reproduction, and handoff render.
4. Export NDJSON and confirm values remain redacted.
5. Record the result as `procedure ok / not evaluable`.

## Blocking conditions

Do not execute the user study until consent, redaction, participants, and ground truth are in place. Do not use the rehearsal result as evidence for H1.
