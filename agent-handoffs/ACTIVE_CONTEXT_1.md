# Active Context Snapshot (submenu/neris-ui)

## Current branch
- `submenu/neris-ui`

## Current focus
- NERIS submenu UI buildout for Incident Report tabs (Location, Emerging Hazards, Resources, Risk Reduction).
- Keep behavior aligned with user-defined UI patterns and naming standards.

## Latest known status
- Latest commit: `e1a2e99` - Adjust resources validation, datetime edits, and popup scrolling.
- Resources tab now includes:
  - unit-level validation (personnel min, required times)
  - datetime-local time editing
  - canceled en route toggle behavior
  - personnel popup flow and scroll handling
  - compact read-only Unit Type styling
- Risk Reduction top PILL sizing was reduced for readability.

## Current blocker / status
- Awaiting user visual/behavior review of latest Resources and Risk Reduction updates.

## External dependency status
- None required for current UI-only iteration.

## Recent key commits (latest first)
- `e1a2e99` Adjust resources validation, datetime edits, and popup scrolling
- `aa6dee7` Refine resources unit selection and personnel popup UX
- `7566a37` Update pill toggles, hazard deletes, and risk reduction UI
- `16499fb` Refine resources unit workflow with RL times, personnel, and completion actions

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read latest session note in `agent-handoffs/branches/submenu--neris-ui/sessions/`.
3. Confirm with user whether to continue on `submenu/neris-ui`.
4. If user reports defects, reproduce on this branch and patch in small commits.
