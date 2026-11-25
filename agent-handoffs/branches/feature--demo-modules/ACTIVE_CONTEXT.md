# Active Context Snapshot (feature/demo-modules)

## Current branch
- `feature/demo-modules`, created 2026-11-25 from `submenu/neris-golive-cifpd` at `18a3567`.
- Each finished step is merged into `submenu/neris-golive-cifpd` (the staging branch) after lint and build pass.

## Plans
- **Demo week plan (work from this):** `docs/plans/demo-week-build-plan.md`. Read "Handoff for the next agent" first, then the step marked next.
- **Full operations plan:** `docs/plans/operations-modules-plan.md`. Section 2 has the file and line references for how the app is wired today.

## Status (2026-11-25)
- **W0 done.**
  - `Comment` table and migration `20261126090000_add_comment`.
  - 12 new permission keys in `server/auth/permissions.mjs`.
  - `server/modules/registerModuleRoutes.mjs` with `GET /api/modules/health`.
  - New menu items: Apparatus > Equipment Maintenance, the Policies menu (Manual, DTB's, Policy Builder admin-only), Admin Functions > Displays.
- **Operator still applies** migration `20261126090000_add_comment` to staging: back up Neon first, then run `node --env-file=.env.server ./node_modules/.bin/prisma migrate deploy`. Nothing reads the table yet, so staging runs fine before this.
- **Next: W0b** (hide-sidebar button), then **W1** (Maintenance).

## Rules that matter here
- Demo menu items keep `isBuilt: false` until their real page lands. Only superadmins can click those items, so CIFPD users on staging never see blank pages.
- Never change the NERIS export or the `NerisDraft` payload. Never change sign-in or session code. Every query filters by `request.tenant.id`.
- `npm test` has two tests that need a local Postgres on 127.0.0.1:5432 (`server sign-in passes`, `fake vendor proves one bill per incident`). They fail on a Mac without it; the other 76 pass.
