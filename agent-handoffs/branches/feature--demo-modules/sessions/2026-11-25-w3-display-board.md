# Agent Handoff Note

## Session metadata
- Date: 2026-11-25 (Chicago evening)
- Agent type: Cursor Desktop, Claude Opus 5.5
- User request focus: build W3 (Display Board), then give click-by-click checks for W2 and W3.
- Working branch: `feature/demo-modules`

## Starting context
- W2 was finished earlier in this chat (`28f2cda`, docs `5d8e6f5`, merged into `submenu/neris-golive-cifpd` as `e34853c`).

## Work completed
- **W3** (code commit on `feature/demo-modules`; see `git log`):
  - Migration `20261126150000_add_displays` (not applied). Tables: `DisplayBoard`, `Announcement`, `DisplayEvent`. Nullable `Incident.latitude`, `longitude`, `geocodedAt`.
  - Server: `server/modules/displays.mjs` (boards, feed, messages, events, incident location), `incidentLocation.mjs` (Census point cache), and `apparatusStatusFor` split out of `maintenance.mjs`. Permission mappings in `server/auth/permissions.mjs`.
  - Pages: Admin Functions > Displays (`src/pages/displays/DisplaysAdminPage.tsx`, now `isBuilt: true`), the TV page `/display/:boardId` (`DisplayBoardPage.tsx`), and the shared `CallMap.tsx`, which is also on the incident page's Live Map panel.
  - Decisions are in the plan's "W3 as built" note.

## Verification
- `npm run lint`: passes. `npm run build`: passes.
- `npx prisma validate` and `npx prisma generate`: pass. No migrate, db push, or seed was run.
- `npm test`: 93 pass, 2 fail. The failures are the known local-Postgres tests. `server/modules/displays.test.mjs` passes: permissions, tenant isolation, overnight on-duty, out-of-service units, message windows, district filter, and the cache keeping `updatedAt`.
- **Not done:** a live browser click-through, because the migration is not applied.

## Git status
- **W3 is NOT merged into `submenu/neris-golive-cifpd`.** This is the first migration that changes an existing table (`Incident`). Incident queries read every column, so staging code would fail on incidents until the migration is applied. Merge only after the operator runs `migrate deploy`.

## Open issues / blockers
- The operator must back up Neon, apply all five pending migrations, then merge W3 into the staging branch.

## Next steps for next agent
1. Confirm the migration is applied and W3 is merged before any W3 fixes.
2. Next step: W4 (Inventory). Restate its scope and whether it reuses the round-3 `ChecklistTemplate` tables.
