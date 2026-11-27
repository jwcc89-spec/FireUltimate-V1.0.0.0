# Active Context Snapshot (feature/demo-modules)

## Current branch
- `feature/demo-modules`, created 2026-11-25 from `submenu/neris-golive-cifpd` at `18a3567`.
- Each finished step is merged into `submenu/neris-golive-cifpd` (the staging branch) after lint and build pass.
- **Staging tip (2026-11-26 evening):** `70781fa` — operator follow-up fixes merged after W4.

## Plans
- **Demo week plan (work from this):** `docs/plans/demo-week-build-plan.md`. Read "Handoff for the next agent" first, then the step marked next. Each finished step has an "as built" note that overrides the plan text.
- **Full operations plan:** `docs/plans/operations-modules-plan.md`. Section 2 has the file and line references for how the app is wired today.

## Status (updated 2026-11-26 late, America/Chicago)
- **W0–W4 done and on staging.** All **23** migrations applied (`prisma migrate status` after W4).
- **W1 Maintenance** (+ polish, apparatus rounds 2–3, parts, inspections). See plan "as built" notes.
- **W2 Maps** (+ follow-up: road default, Google Layer off, Places autocomplete, last-call + 500' radius, FULL SCREEN). Incident list sample cards removed (Dashboard reminder parked).
- **W3 Display board** (+ follow-up: 8×8 layout editor, pulse, on-screen directions, banner `   --   `, incident number header, Section 7 equipment).
- **W4 Checklists** at File Center > Checklists. Migration `20261127100000_add_checklists` (`ChecklistAssignment`, `Kit`). Templates/versions/submissions reuse checklist tables with `subjectKind = "checklist"`.
- **Operator evening follow-up (2026-11-26, no schema, merge `70781fa`):**
  - Takeover pulse every **1 second** (not 4).
  - Takeover length already admin-settable **10–600 seconds** per board.
  - CallMap / takeover directions map default **roadmap** (not satellite).
  - Breadcrumb: Incidents / Mapping > Incidents > Incident Detail.
  - Inspection **Save** = Draft; **Submit** = full validation; Continue on list.
  - Equipment maintenance OOS syncs Equipment List status (and clears when last open OOS ticket is gone).
  - Sidebar collapse on the active menu sticks.
  - Checklists: Templates, Assignments, Kits are **admin-only**; users only see Checklists. Mark Reviewed is admin-only.

### Staging Google key (operator)
- `VITE_GOOGLE_MAPS_API_KEY` on the Render staging build.
- Enable **Places API (New)** for map search suggestions.
- Enable **Routes API** for on-screen directions.

### Waiting on operator approval (schema / out of pure demo rush)
- **Units** page: In Reserve status + apparatus profile (IDs, specs, fluids, tire pressures, sticker photo, directory). Needs `ApparatusProfile` (or similar) approval.
- **Maintenance labor** tab: pay rates + labor lines. Demo-sized "Maintenance labor" list OK; full Groups/permissions system is **out of demo rush**.
- **Groups / committees** for routing flagged checklists (EMS, TRT, etc.) — Later; Mark Reviewed stays admin-only for now.
- **Later (no code yet):** SSE/WebSocket for true instant takeover; auto-assign daily apparatus checks to the crew on that unit for the day; Dashboard "checks due" widget (fits W5).

### Operator verification
- **2026-11-26 (America/Chicago):** operator confirmed remaining W4 work and the evening follow-up **click checks passed**.

### W5 Dashboard (2026-11-26 late, built, NOT on staging yet)
- Operator approved the `DashboardLayout` table and asked for two extra widgets: **Trades - Active Requests** and **Calendar**.
- Migration `20261128100000_add_dashboard_layout` is **written, not applied**. Staging needs it (Neon backup first) **before** merging into `submenu/neris-golive-cifpd`. After it, staging has **24** migrations.
- Routes: `server/modules/dashboard.mjs` (`/api/dashboard/layout`, `/layout/default` = `displays.manage`, `/summary`). Page: `src/pages/dashboard/`. Details in the plan's "W5 as built".
- 12 widgets: Clock, Call Stats, Incidents, Last Call Map, On Duty, Apparatus Status, Open Maintenance, Checks Due, Trades - Active Requests, Calendar (DisplayEvent events), Quick Links, DTB's Due (placeholder until W6).

### Next
1. Apply the W5 migration to staging (when the operator says so), merge `feature/demo-modules` into `submenu/neris-golive-cifpd`, operator click checks.
2. Then **W6 Policies**: show the seven-table migration and wait for approval.

## Rules that matter here
- **The operator tests on staging, not locally.** Click checks target `https://cifpdil.staging.fireultimate.app` after a merge into `submenu/neris-golive-cifpd` and a Render redeploy. Don't ask for `npm run dev` or `localhost` unless there is no other way.
- Demo menu items keep `isBuilt: false` until their real page lands. Only superadmins can click those items, so CIFPD users on staging never see blank pages.
- Never change the NERIS export or the `NerisDraft` payload. Never change sign-in or session code. Every query filters by `request.tenant.id`.
- Do **not** modify Prisma schema / migrations / auth without explicit approval. Apply migrations to staging **before** merging code that needs them.
- The local `.env.server` points at the Neon staging database. Do not run migrations or test writes from a local server unless the user asks. Load it with `node --env-file=.env.server ./node_modules/prisma/build/index.js …` (do not `source` the file; it can fail to parse).
- `npm test` has two tests that need a local Postgres on 127.0.0.1:5432 (`server sign-in passes`, `fake vendor proves one bill per incident`). They fail on a Mac without it; the other **104** pass (as of W5).
- Never add per-column filter boxes back to `ModuleTable`; the operator doesn't want them. Pass filter chips through its `toolbarStart` prop.
- Reuse `src/components/ModuleTable.tsx` for module lists and `useModuleLookups()` (`src/moduleLookups.ts`) for apparatus, stations and personnel.
- Match Claude W0/W1 style: page-section, panel, EditDialog, useDialogSave, ModuleTable, maintenance-tabs, lucide icons.
- End every response with: **Agent used for this response:** Claude Opus 5.5 (unless the user named a different agent for that chat).
