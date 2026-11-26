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
- **W1 polish done** (`dc7cef9`, merged as `6e7c4b8`). This round came from the operator's first click-through and needed no migration:
  - Record numbers are now `YY-NNNN`.
  - New status Parts Ordered.
  - Assigned To and Taken Out of Service were added. The completion time is stamped automatically, which gives down time.
  - The Apparatus dropdown is the first field on the form.
  - The table has new default columns, no filter boxes, and Edit Columns on the chip row.
  - Analytics has a Cost and Down Time page.
  - Dropdowns open upward when there isn't room below.
  - The top-bar breadcrumb menu name opens the sidebar menu.
  - Details are in the plan's "W1 polish round" note.
- **Apparatus round 2 done** (`5cdf331`, merged as `27f257e`, no schema): Fleet Overview at `/apparatus`, `GET /api/maintenance/apparatus-status`, readings needed to complete, the Deficiency type, Add Vendor from search, Preventive Maintenance wording.
- **Apparatus round 3 done** (operator approved the migration on 2026-11-25). Commits: `1d96cf9` (migration and PM tracking), `491f427` (inspections and Fleet Overview), `7c0fb57` (parts).
  - Migration `20261126110000_add_parts_pm_inspections` is additive only. It adds `Part`, `PartTransaction`, `ChecklistTemplate`, `ChecklistTemplateVersion` and `ChecklistSubmission`, plus five nullable or defaulted `PmSchedule` columns.
  - New server modules: `server/modules/parts.mjs`, `inspections.mjs`, `inspectionDefaults.mjs` and `moduleHelpers.mjs` (shared helpers moved out of `maintenance.mjs`).
  - Details are in the plan's "Apparatus round 3 as built" note.
- **Round 3 follow-up done** (no schema change): the breadcrumb is the page title, and big h1s are hidden unless they have `page-title-keep`. Also: the Apparatus submenu was reordered, the dropdown scroll jump is fixed, inspection sections collapse, and inspections have required fields and fill from the apparatus and its last oil change. See the plan's "Round 3 follow-up" note.
- **Round 3 follow-up 2 done** (no schema change): inspection categories start collapsed. "Oil and Filter Change" is the dedicated oil change category, with an Oil Change panel on tickets and Log Oil Change on PM tasks, and it feeds the inspection's Last Service. See the plan's "Round 3 follow-up 2" note.
- **Operator still applies all three migrations to staging** (`20261126090000_add_comment`, `20261126100000_add_maintenance`, `20261126110000_add_parts_pm_inspections`):
  1. Back up Neon first.
  2. Run `node --env-file=.env.server ./node_modules/.bin/prisma migrate deploy`.
  - Until then, the maintenance, inspection and Fleet Overview pages show load errors. Nothing else is affected.
- **Next: W2** (maps, overlays and geofences). It needs the operator's Google Maps browser key (`VITE_GOOGLE_MAPS_API_KEY`) first.

## Rules that matter here
- Demo menu items keep `isBuilt: false` until their real page lands. Only superadmins can click those items, so CIFPD users on staging never see blank pages.
- Never change the NERIS export or the `NerisDraft` payload. Never change sign-in or session code. Every query filters by `request.tenant.id`.
- The local `.env.server` points at the Neon staging database. Do not run migrations or test writes from a local server unless the user asks.
- `npm test` has two tests that need a local Postgres on 127.0.0.1:5432 (`server sign-in passes`, `fake vendor proves one bill per incident`). They fail on a Mac without it; the other 86 pass.
- Never add per-column filter boxes back to `ModuleTable`; the operator doesn't want them. Pass filter chips through its `toolbarStart` prop.
- Reuse `src/components/ModuleTable.tsx` for module lists and `useModuleLookups()` (`src/moduleLookups.ts`) for apparatus, stations and personnel.
