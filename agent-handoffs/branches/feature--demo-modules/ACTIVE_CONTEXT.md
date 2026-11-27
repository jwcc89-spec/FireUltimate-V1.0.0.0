# Active Context Snapshot (feature/demo-modules)

## Current branch
- `feature/demo-modules`, created 2026-11-25 from `submenu/neris-golive-cifpd` at `18a3567`.
- Each finished step is merged into `submenu/neris-golive-cifpd` (the staging branch) after lint and build pass.
- **Staging tip (2026-11-27):** `a173c43` — W6 Policies merged.

## Plans
- **Demo week plan (work from this):** `docs/plans/demo-week-build-plan.md`. Read "Handoff for the next agent" first, then the step marked next. Each finished step has an "as built" note that overrides the plan text.
- **Full operations plan:** `docs/plans/operations-modules-plan.md`. Section 2 has the file and line references for how the app is wired today.

## Status (updated 2026-11-27, America/Chicago)
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

### W5 Dashboard (done, on staging)
- Operator approved the `DashboardLayout` table and asked for two extra widgets: **Trades - Active Requests** and **Calendar**.
- Migration `20261128100000_add_dashboard_layout` applied to staging (**24** migrations). Merged as `a06595f`. **Operator confirmed all W5 click checks passed (2026-11-27).**
- Routes: `server/modules/dashboard.mjs` (`/api/dashboard/layout`, `/layout/default` = `displays.manage`, `/summary`). Page: `src/pages/dashboard/`. Details in the plan's "W5 as built".
- 12 widgets: Clock, Call Stats, Incidents, Last Call Map, On Duty, Apparatus Status, Open Maintenance, Checks Due, Trades - Active Requests, Calendar (DisplayEvent events), Quick Links, DTB's Due (placeholder until W6).

### W6 Policies (done, on staging)
- Operator approved the seven tables and said: publishing assigns to everyone; make `/policies` the Lexipol-style home.
- Migration `20261129100000_add_policies` applied to staging (**25** migrations). Merged as `a173c43`. **Operator confirmed W6 click checks passed (2026-11-27)**; some changes will come later (not demo-blocking, not yet specified).
- Server: `server/modules/policies.mjs` + `policies.test.mjs` (in `npm test`); permission lines in `permissionForRequest`.
- Pages: `src/pages/policies/` (home, Manual/DTB's library, Policy Builder with TipTap editor, assignments/templates/random rules). Dashboard DTB's widget is real now. Menu items `isBuilt: true`.
- PDF attachments capped at **2.5 MB** (4 MB request limit). Details in the plan's "W6 as built".

### W7 Fire Prevention (in progress)
- Operator approved the 4 tables (`Property`, `PropertyContact`, `PrePlan`, `Inspection`) on 2026-11-27. One migration for all of W7: `20261130100000_add_fire_prevention` (**written, NOT applied**; makes 26).
- Decisions: fixed type lists for the demo; Schedules tab = upcoming list; **anyone** completes inspections; NERIS picker always adds a **Person** (role → affiliation); keep the property name field.
- **7a built** (properties list + map, create/edit with Street View / Aerial / draggable pin / thumbnail / Take Photo, property screen, contacts). Routes `server/modules/prevention.mjs` (reads `incidents.view`, writes `prevention.manage`). Properties menu item `isBuilt: true`. Details in the plan's "W7 as built".

### Next
1. Operator: Neon backup `backup-before-w7`, apply the migration (expect 26), merge `feature/demo-modules`, run the 7a click checks.
2. **7b:** CSV import, Incidents tab (call history), Basic/Complex pre-plans + Pre-Plans page, geofence link picker.
3. **7c:** Inspections. **7d:** NERIS "Add from Properties".
4. W6 follow-up changes when the operator lists them.
2. W6 follow-up changes when the operator lists them.

## Rules that matter here
- **The operator tests on staging, not locally.** Click checks target `https://cifpdil.staging.fireultimate.app` after a merge into `submenu/neris-golive-cifpd` and a Render redeploy. Don't ask for `npm run dev` or `localhost` unless there is no other way.
- Demo menu items keep `isBuilt: false` until their real page lands. Only superadmins can click those items, so CIFPD users on staging never see blank pages.
- Never change the NERIS export or the `NerisDraft` payload. Never change sign-in or session code. Every query filters by `request.tenant.id`.
- Do **not** modify Prisma schema / migrations / auth without explicit approval. Apply migrations to staging **before** merging code that needs them.
- The local `.env.server` points at the Neon staging database. Do not run migrations or test writes from a local server unless the user asks. Load it with `node --env-file=.env.server ./node_modules/prisma/build/index.js …` (do not `source` the file; it can fail to parse).
- `npm test` has two tests that need a local Postgres on 127.0.0.1:5432 (`server sign-in passes`, `fake vendor proves one bill per incident`). They fail on a Mac without it; the other **113** pass (as of W7a).
- Never add per-column filter boxes back to `ModuleTable`; the operator doesn't want them. Pass filter chips through its `toolbarStart` prop.
- Reuse `src/components/ModuleTable.tsx` for module lists and `useModuleLookups()` (`src/moduleLookups.ts`) for apparatus, stations and personnel.
- Match Claude W0/W1 style: page-section, panel, EditDialog, useDialogSave, ModuleTable, maintenance-tabs, lucide icons.
- End every response with: **Agent used for this response:** Claude Opus 5.5 (unless the user named a different agent for that chat).
