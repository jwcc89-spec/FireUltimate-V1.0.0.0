# Active Context Snapshot (feature/demo-modules)

## Current branch
- `feature/demo-modules`, created 2026-11-25 from `submenu/neris-golive-cifpd` at `18a3567`.
- Each finished step is merged into `submenu/neris-golive-cifpd` (the staging branch) after lint and build pass.

## Plans
- **Demo week plan (work from this):** `docs/plans/demo-week-build-plan.md`. Read "Handoff for the next agent" first, then the step marked next. Each finished step has an "as built" note that overrides the plan text.
- **Full operations plan:** `docs/plans/operations-modules-plan.md`. Section 2 has the file and line references for how the app is wired today.

## Status (2026-11-25)
- **W0 done.**
  - `Comment` table and migration `20261126090000_add_comment`.
  - 12 new permission keys in `server/auth/permissions.mjs`.
  - `server/modules/registerModuleRoutes.mjs` with `GET /api/modules/health`.
  - New menu items: Apparatus > Equipment Maintenance, the Policies menu (Manual, DTB's, Policy Builder admin-only), Admin Functions > Displays.
- **W0b done** (`e43ebe3`): hide-sidebar button in the top bar (desktop only), saved under `fu.sidebarHidden`.
- **W1 done** (`b4afbec`): Maintenance.
  - Migration `20261126100000_add_maintenance` adds six tables: `MaintenanceRecord`, `MaintenanceType`, `Vendor`, `MaintenanceCost`, `PmSchedule`, `Equipment`.
  - Pages: Apparatus > Maintenance Logs, Equipment Maintenance, and Equipment List, all now `isBuilt: true`.
  - Details are in the plan's "W0b and W1 as built" note.
- **Merged into `submenu/neris-golive-cifpd` and pushed** after W1.
- **Operator still applies both migrations to staging** (`20261126090000_add_comment` and `20261126100000_add_maintenance`):
  1. Back up Neon first.
  2. Run `node --env-file=.env.server ./node_modules/.bin/prisma migrate deploy`.
  - Until then, the three maintenance pages show "Could not load maintenance data." Nothing else is affected.
- **Next: W2** (maps, overlays and geofences). It needs the operator's Google Maps browser key (`VITE_GOOGLE_MAPS_API_KEY`) first.

## Rules that matter here
- Demo menu items keep `isBuilt: false` until their real page lands. Only superadmins can click those items, so CIFPD users on staging never see blank pages.
- Never change the NERIS export or the `NerisDraft` payload. Never change sign-in or session code. Every query filters by `request.tenant.id`.
- The local `.env.server` points at the Neon staging database. Do not run migrations or test writes from a local server unless the user asks.
- `npm test` has two tests that need a local Postgres on 127.0.0.1:5432 (`server sign-in passes`, `fake vendor proves one bill per incident`). They fail on a Mac without it; the other 81 pass.
- Reuse `src/components/ModuleTable.tsx` for module lists and `useModuleLookups()` (`src/moduleLookups.ts`) for apparatus, stations and personnel.
