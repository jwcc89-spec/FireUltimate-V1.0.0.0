# Agent Handoff Note — deploy checkpoint + Step 1 requirements gate

## Session metadata
- Date (UTC): 2026-03-11
- Branch: `submenu/neris-golive-cifpd`
- User intent: fix deploy-status confusion first, document exact resume steps, then gather mandatory Step 1 (Incident Detail editable inputs) requirements before implementation.

## What was verified
- Staging:
  - tenant/context OK
  - neris/health OK (`api-test`, credentials present, `hasTenantEntityId=false`)
  - debug/entity-check OK for `FD17075450`
- Production:
  - tenant/context OK
  - neris/health OK (`api`)
  - debug/entity-check route missing (`Cannot GET`) because production deploy tracks `main`, branch changes not yet merged.

## What was updated
- Updated `ACTIVE_CONTEXT.md` with latest endpoint status and explicit mandatory blocker.
- Added `docs/GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md` as pick-up file for next agent/user.

## Mandatory blocker status
- Step 1 (editable incident input boxes on Incident Detail page) is mandatory and not yet built in this note.
- Next action is requirement confirmation with user before coding that batch.

## Next agent first actions
1. Read:
   - `ACTIVE_CONTEXT.md`
   - `docs/GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md`
   - `docs/NERIS_RENDER_SOURCE_OF_TRUTH.md`
2. Ask user to confirm exact Step 1 editable field list and save behavior.
3. Implement Step 1 only after requirements are confirmed.
