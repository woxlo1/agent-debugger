## Summary

What changed and why.

## Scope check

- [ ] This change stays within import / schema / evidence / handoff or an adjacent fix.
- [ ] No live pause/inject, eval, cloud, or custom DAP implementation.
- [ ] Repository artifacts are in English.
- [ ] No secrets, customer data, or raw trace payloads were added.

## Verification

- [ ] `node --check` passes for changed JavaScript files.
- [ ] `npx tsc --noEmit -p packages/server/tsconfig.json` passes.
- [ ] `npx tsc --noEmit -p packages/sdk/tsconfig.json` passes.
- [ ] `npm run build -w packages/web` passes.

## Cause Package impact

If analyzer behavior changed, describe which rule changed and what evidence it produces.
