# What needs to be completed — consolidated list

Pulled from GO_LIVE_CHECKPOINT, BACKLOG_INCIDENTS_NERIS_UX, LATER_TASKS_VALIDATE_EXPORT_ROLES_AND_ADMIN_VISIBILITY, and `later-changes-backlog.md`. Use this to prioritize next work.

**For backlog items #2–#11 (Incidents and NERIS form UX),** see **`docs/procedures/BACKLOG_INCIDENTS_NERIS_UX.md`** for full detail (issue, desired behavior, options). This file is the master list and order; BACKLOG is the implementation reference.

---

## Recently completed (tenant verification + code, 2026-03)

| Item | Notes |
|------|--------|
| **CAD email receiving** | Ingest path live; emails stored; **parsing / auto-create incident** is next (`#29`). |
| **NERIS cross-browser (export history + drafts)** | Server-backed history and drafts; migration run. |
| **View Exports — Report Status** | **Done (2026-03, staging verified).** Successful export shows **Exported** on **Reporting \| NERIS \| Exports** (matches NERIS queue); fixes second-browser **Draft** and post-validate **In Review** mismatch. `getExportsListReportStatus` + append stores **Exported** on success (`App.tsx`, `NerisReportFormPage.tsx`). |
| **Incident Detail cross-browser** | Edits in Browser A visible in Browser B via API — go-live Item #1 treated **done** for current workflow. |
| **Merge / deploy** | Branch merged/deployed per tenant (staging/prod as applicable). |
| **Reported By in Edit (#2)** | Detail no longer overwrites API values; dropdown includes saved value so Edit shows what was selected/entered at create. |
| **Dispatch notes & Callback save (#3)** | Same fix — display uses API; save already sent PATCH; values persist after refresh. |
| **Create Incident onset date/time (#4)** | Create Incident modal has **Incident onset date** (YYYY-MM-DD) and **Incident onset time** (24h HH:MM:SS); stored in `receivedAt` and mapped to NERIS **Incident Onset Date & Time**. |
| **Initial dispatch code (#6)** | Default in `createDefaultNerisFormValues` changed from `AMB.UNRESP-BREATHING` to empty; location: `src/nerisMetadata.ts`. |
| **Aid department – remove "Current export department" (#8)** | Synthetic option removed from CORE Aid department name(s) dropdown in `NerisReportFormPage.tsx`. |

---

## Priority order (what to do first)

| Priority | Item | Guide / reference |
|----------|------|-------------------|
| **1** | **CAD email parsing + auto-create incident** | `CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md` (see also `EMAIL_AND_CAD_SETUP.md`). After this: point Worker `CAD_INGEST_API_URL` to production. |
| **2** | **NERIS / go-live backlog** | BACKLOG items #2–#11, #8 aid self-select, etc. |
| 3+ | Rest of list | See “Suggested order to prioritize” at the bottom. |

---

## Critical / mandatory (go-live)

| # | Item | Source | Notes |
|---|------|--------|--------|
| 1 | **Incident Detail page: editable + API save** | GO_LIVE_CHECKPOINT §2 | **Done (2026-03, tenant testing).** Edits persist via API; verified across browsers. Re-open if a field regresses. |

### Expanded: Item 1 (closed out)

Originally: Incident Detail needed editable fields and **PATCH /api/incidents** so changes sync across browsers. **Tenant testing (2026-03):** satisfied — Browser B sees edits from Browser A. If new gaps appear, track under BACKLOG #2–#3.

---

## Incidents and NERIS form UX (backlog)

| # | Item | Source | Notes |
|---|------|--------|--------|
| 2 | **Reported By** in Edit | BACKLOG #1 | **Done (2026-03).** No overwrite; dropdown shows saved value. |
| 3 | **Dispatch notes and Callback** save in Edit | BACKLOG #2 | **Done (2026-03).** Persist and display; timeline supports string or array. |
| 4 | **Times: military (24h)** not AM/PM app-wide | BACKLOG #3 | **Partial (2026-03-18):** NERIS Core onset + Incident Times use 24h `HH:MM:SS`. Incidents / rest of app still open. |
| 5 | **Incidents Setup – Edit Reported By** layout spills into Assigned Units | BACKLOG #4 | Fix layout so controls are visible and don’t overlap. |
| 6 | **Initial dispatch code** – source (NERIS / CAD / blank) | BACKLOG #5 | Default now empty (`nerisMetadata.ts`). Document mapping when CAD/NERIS finalized. |
| 7 | **AID GIVEN/RECEIVED** – Aid departments from NERIS, grouped by state (e.g. FD29081313) | BACKLOG #6 | **Largely done (11.3):** NERIS entity directory + DD-M + CORE. **Open:** exclude/grey-out tenant’s own FD (#8). |
| 8 | **Aid Department:** do not allow selecting tenant’s own department (exclude or grey out) | BACKLOG #10 | UI: exclude or disable self in list. Server already strips. |
| 9 | **Required-if:** FIRE module when fire + auto aid given | BACKLOG #7 | **Done (2026-03-18)** for aid-given + direction **Given** case (see 11.3c). Re-confirm vs NERIS spec if rules expand. |
| 10 | **Resources UNIT TYPE** – show Apparatus value, not placeholder | BACKLOG #8 | Pull from Department Details Apparatus. |
| 11 | **Resources Populate Date** – dates only for dispatch/en route/on scene/clear; add Returning | BACKLOG #9 | Fix button behavior; add Returning field(s). |
| 11.1 | **Narrative Builder** – guided narrative composition | 2026-03-17 | Add a Narrative Builder to help users create detailed narratives by pre-populating structured information based on narrative type. |
| 11.2 | **Additional occupant contact fields** – capture + map to NERIS | 2026-03-17 | Add additional contact fields for occupant information and map them into the appropriate NERIS fields/modules. |
| 11.3 | **Mutual aid directory + tenant allowlist** | 2026-03-18 | **Done:** `GET /api/neris/entities` (cache, `page_size` ≤100) + DD-M (state-grouped, **Add local**, Reload / Refresh w/ platform admin key). Payload: `mutualAidDepartmentSelections`. NERIS form uses configured list when ≥1 entry; else full directory. |
| 11.3a | **CORE “Aid department name(s)” — friendly name in UI** | 2026-03-18 | **Done.** Dropdown **label** = department name only; **value** / export = FD/FM NERIS ID (unchanged). |
| 11.3b | **Local-only mutual aid rows in CORE aid dropdown** | 2026-03-18 | **Done.** Local DD-M entries appear in CORE; synthetic `LOCAL_AID_OPT:*` stored in form; **not** sent as `department_neris_id` (document in narrative if needed). |
| 11.3c | **FIRE requiredness when mutual aid given** | 2026-03-18 | **Done (client).** When “Was aid given?” = Yes and **Aid direction** = **Given**, FIRE-module fields are **not** required (see `isNerisFieldRequired` in `src/nerisMetadata.ts`). |
| 11.3d | **NERIS Core + Incident Times — 24h `HH:MM:SS`** | 2026-03-18 | **Done** for those fields (Core onset + Incident Times module). **Open:** app-wide 24h (#4) elsewhere. |

---

## Validate / Export and roles (later tasks)

| # | Item | Source | Notes |
|---|------|--------|--------|
| 12 | **Validate for all users; Export admin-only** (hide Export for non-admin) | LATER_TASKS Part 1 | Validate visible to all; Export button only for admin; optional API guard for export. |
| 13 | **Super admin** – hidden user type, 1–2 per account, special visibility | LATER_TASKS Part 2 | Not in UI dropdown; assign via DB or platform tool; super-admin–only fields/buttons. |
| 14 | **Admin show/hide mode** – toggle field and menu visibility per user type | LATER_TASKS Part 3 | Button to enter mode; click fields/menus to set show/hide by user type; persist and apply. |
| 14.1 | **Role hierarchy inheritance + tenant-configurable capabilities (plan + implementation)** | 2026-03-17 | Ensure “admin-and-up” includes superadmin globally, and implement extensible role hierarchy + named permissions (capabilities) so future roles (e.g. secretary, subadmin) follow tenant ordering. Plan: `docs/plans/TENANT_ROLES_AND_PERMISSIONS_PLAN.md`. |

---

## Admin and platform (later-changes-backlog)

| # | Item | Source | Priority | Notes |
|---|------|--------|----------|--------|
| 15 | Replace prompt-style reset-password UX with in-app modal/dialog | later-changes-backlog | P2 | Department Access. |
| 16 | Auth rate-limiting and/or lockout for failed logins | later-changes-backlog | P1 | Security. |
| 17 | Password reset/change audit logging (who, when, target) | later-changes-backlog | P2 | Security. |
| 18 | Revisit advanced scheduling model (forward-only sync + optional backfill) | later-changes-backlog | P2 | Scheduler Settings. |
| 19 | Search/filter for larger user/personnel datasets | later-changes-backlog | P2 | Personnel Management. |
| 20 | Deploy frontend staging as separate Render service | later-changes-backlog | P2 | Platform. |
| 21 | Configurable tenant policy for demo-style tenants | later-changes-backlog | P2 | Platform. |
| 22 | Wildcard DNS `*.fireultimate.app` for faster tenant onboarding | later-changes-backlog | P2 | Platform. |
| 23 | Evaluate Cloudflare proxied mode (orange cloud) after DNS-only baseline | later-changes-backlog | P3 | Platform. |
| 24 | Optimize frontend bundle size and chunking | later-changes-backlog | P3 | Platform. |

---

## Future changes (general UI)

| # | Item | Status | Notes |
|---|------|--------|--------|
| L1 | **Login screen:** Remove "Fire Department (optional)" field | **Done** 2026-03-16 | Implemented on menu-submenu/ui-updates. |
| L2 | **Login screen:** Remove helper text | **Done** 2026-03-16 | Implemented on menu-submenu/ui-updates. |
| L3 | **Login screen:** Show tenant picture | **Done** 2026-03-16 | Tenant logo on login and in form header (right). |
| L4 | **"Scaffolded" → "Beta":** Replace all "Scaffolded" wording with *Beta* (italicized blue text) | **Done** 2026-03-16 | Applies to submenu cards. |
| L5 | **Beta sections – super admin only (clickable):** For super admin only, beta submenus remain viewable and clickable. | **Done** 2026-03-16 | UserRole superadmin; sidebar/cards clickable only for super admin. |
| L6 | **Beta sections – admin and lower (not clickable):** Show label with "beta"; do not allow click. | **Done** 2026-03-16 | Sidebar: span + Beta for non–super-admin. |
| L7 | **Beta cards on main menu:** Card visible but not clickable for admin and lower; only super admin can open. | **Done** 2026-03-16 | submenu-card-beta for non–super-admin. |

**Reference:** See also `docs/later-changes-backlog.md` (Login / Auth, UI Conventions).

---

## Optional / when ready

| # | Item | Source | Notes |
|---|------|--------|--------|
| 25 | **CAD email ingest (receive + store)** | GO_LIVE §6, EMAIL_AND_CAD_SETUP | **Receiving path done.** **Open:** parsing / auto-create (`#29`); then Worker → production API URL. |
| 26 | **NERIS cross-browser** | User report | **Done** for export history, drafts, lock, and **View Exports Report Status** (Exported after success, cross-browser). See `NERIS_CROSS_BROWSER_FINDINGS.md`. **Open:** draft edge cases only if reported. |
| 27 | **Production endpoint checks and first controlled production export** | GO_LIVE §3.6–3.7 | Re-run tenant/context, neris/health, entity-check on prod; perform first prod export when ready. |
| 28 | **Future architecture:** per-tenant NERIS config in DB (nerisEntityId, etc.); resolve tenant by domain and load config per request | TENANT_ONBOARDING §H | Scale; keep NERIS_BASE_URL global by environment. |
| 29 | **CAD email parsing and auto-create incident** | CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN | Incident Settings → Parsing Data; per-tenant rules; auto-create draft incident; dedupe; optional sequencing. **Next major platform item** (NERIS cross-browser phases complete). |

### Expanded: NERIS cross-browser (#26) — resolved + follow-up

- **Was:** Export history / drafts only in localStorage; second browser saw empty history and Draft on exports list.
- **Now:** Server-backed export history and drafts; migrations applied. **View Exports** **Report Status:** if latest export is **success**, show **Exported** (matches queue; not pre-submit “In Review”). **`getExportsListReportStatus`** in `App.tsx`; successful append stores **Exported** in `NerisReportFormPage`.
- **Details:** `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md`.

---

## Suggested order to prioritize

1. **CAD parsing + auto-create incident (#29)** — then Worker **`CAD_INGEST_API_URL`** → production.
2. **High-impact UX:** Reported By and dispatch notes/callback save (#2, #3), Edit Reported By layout (#5), Aid Department no self-select (#8).
3. **App-wide consistency:** Military time (#4).
4. **NERIS correctness:** Initial dispatch code (#6); Aid self-select UI (#8); UNIT TYPE (#10); Populate Date + Returning (#11).
5. **Production checks (#27)** — entity-check, controlled export.
6. **Roles and security:** Validate for all / Export admin-only (#12), auth rate-limiting (#16).
7. **Later:** Super admin (#13), admin show/hide mode (#14), backlog #15–#24, per-tenant NERIS (#28).

---

**Sources:**  
- `docs/procedures/GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md`  
- `docs/procedures/BACKLOG_INCIDENTS_NERIS_UX.md`  
- `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md`  
- `docs/procedures/LATER_TASKS_VALIDATE_EXPORT_ROLES_AND_ADMIN_VISIBILITY.md`  
- `docs/later-changes-backlog.md`  
- `docs/procedures/TENANT_ONBOARDING_CHECKLIST.md` (§H)

---

## Session notes

**2026-03-20:** Doc refresh; View Exports uses server export row (cross-browser Draft fix).  
**2026-03:** Staging verified — View Exports **Report Status** shows **Exported** after successful NERIS submit (queue and list aligned; In Review mismatch fixed).

---

## Still pending (at a glance)

Use **Suggested order** below for sequencing. This is a single checklist of what remains.

| Area | Pending |
|------|---------|
| **CAD** | **#29** Parsing + auto-create incident → then Worker **`CAD_INGEST_API_URL`** → production (#25). |
| **Incidents / NERIS UX** | **#2** Reported By in Edit; **#3** dispatch notes + callback save; **#4** 24h times app-wide (partial done); **#5** Edit Reported By layout; **#6** initial dispatch code; **#8** aid self-select exclude; **#10** UNIT TYPE; **#11** Populate Date + Returning; **#11.1** Narrative Builder; **#11.2** occupant contact fields. **Next:** Delete Incident must not delete NERIS report when In Review or Exported (BACKLOG #11). |
| **Roles / admin** | **#12** Validate all / Export admin-only; **#13** super admin; **#14** show/hide mode; **#14.1** role hierarchy + capabilities. |
| **Platform** | **#15–#24** (reset-password UX, auth rate limit, audit logs, scheduling, personnel search, staging service, demo policy, wildcard DNS, Cloudflare, bundle size). |
| **Go-live / ops** | **#27** Production entity-check + controlled first prod export. |
| **Architecture** | **#28** Per-tenant NERIS config scale-out (when ready). |

---

Update this file as items are completed (e.g. move to a “Done” section with date).
