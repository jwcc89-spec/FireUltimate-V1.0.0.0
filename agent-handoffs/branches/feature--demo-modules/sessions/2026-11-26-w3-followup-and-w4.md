# 2026-11-26 — W3 follow-up round and W4 Checklists

Agent: Claude Opus 5.5.

## Asked
- A faster display-board takeover.
- Drag-and-resize widgets on an 8x8 grid.
- A maintenance labor tab, with the question whether Groups fits the demo.
- A Units apparatus profile.
- Equipment List items in inspection Section 7.
- The incident number in the incident page header.
- Directions shown on screen.
- A `   --   ` banner separator.
- Then W4, with click-by-click staging checks.

## Done
- `fe8d559` (no schema), merged into `submenu/neris-golive-cifpd` as `10175f5`:
  - pulse route and 4-second poll
  - `layoutJson.grid` with the editor
  - Routes API directions in `CallMap`
  - banner separator
  - incident header
  - Section 7 equipment rows, where an X opens an Equipment request
- W4 Checklists:
  - `server/modules/checklists.mjs` with tests
  - `src/api/checklists.ts` and `src/pages/checklists/*`
  - Migration `20261127100000_add_checklists` (ChecklistAssignment, Kit), written and **not applied**.
- Checks:
  - lint and build pass.
  - `npm test` is 98 of 100. The 2 failures are the known tests that need a local Postgres.

## Not done / waiting
- W4 migration applied on staging 2026-11-26 (operator asked "Apply the w4 migration"), then merged into `submenu/neris-golive-cifpd`.
- Labor, Groups and Units profile need schema approval. The recommended demo-sized design is in the chat answer and in ACTIVE_CONTEXT.
- The Google key needs Routes API turned on for directions.
