# What needs to be completed — consolidated list

Pulled from GO_LIVE_CHECKPOINT, BACKLOG_INCIDENTS_NERIS_UX, LATER_TASKS_VALIDATE_EXPORT_ROLES_AND_ADMIN_VISIBILITY, and `later-changes-backlog.md`. Use this to prioritize next work.

**For backlog items #2–#11 (Incidents and NERIS form UX),** see **`docs/procedures/BACKLOG_INCIDENTS_NERIS_UX.md`** for full detail (issue, desired behavior, options). This file is the master list and order; BACKLOG is the implementation reference.

---

## Priority order (what to do first)

| Priority | Item | Guide / reference |
|----------|------|-------------------|
| **1** | **CAD email ingest** | `docs/procedures/EMAIL_AND_CAD_SETUP.md` — get email to CAD Dispatch, run a sample import. |
| **2** | **NERIS not loading in another browser** | `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md` — export history and report data only in localStorage; persist on server. |
| 3 | Incident Detail editable inputs (go-live blocker) | See “Critical / mandatory” below. |
| 4+ | Rest of list | See “Suggested order to prioritize” at the bottom. |

---

## Critical / mandatory (go-live)

| # | Item | Source | Notes |
|---|------|--------|--------|
| 1 | **Incident Detail page: editable incident input boxes** | GO_LIVE_CHECKPOINT §2 | See expanded description below. |

### Expanded: What Item 1 (Incident Detail editable inputs) means

- **Which page:** The **Incident Detail** page is the screen you get when you open **Incidents → Mapping → Incidents**, then **click a row** in the incident list. The URL is like `/incidents-mapping/incidents/{callNumber}`. It shows one incident’s details (address, type, priority, reported by, callback number, dispatch notes, assigned units, etc.).

- **What’s wrong today:** The checkpoint doc says this page is “mostly display-only and needs editable inputs.” So either:
  - Not all of the agreed incident fields are editable (some are still read-only or missing), and/or
  - Saving doesn’t persist to the **API** (e.g. PATCH `/api/incidents/...`), so changes stay only in the browser and don’t sync across devices or survive a different browser.

- **What “done” looks like:**  
  End users can **edit** the agreed incident fields on this page (e.g. incident number, dispatch number, type, priority, address, reported by, callback number, dispatch notes, assigned units, state) in **input boxes** (or equivalent controls). When they click **Save**, the app calls the **server** (e.g. PATCH to the incident API) so the change is stored in the database and is visible everywhere (other browsers, NERIS queue, etc.). No need for a separate “Edit Incident” flow; the Incident Detail page itself is the place to view and edit that incident.

- **Why it was called a blocker:** So the department has a single, consistent place to correct or update an incident after creation, with changes persisted to the server. Until that’s in place, edits on Incident Detail don’t fully “stick” or don’t sync.

You can still **prioritize CAD email ingest first** (see below); Item 1 remains the main go-live **mandatory** item when you’re ready to close it out.

---

## Incidents and NERIS form UX (backlog)

| # | Item | Source | Notes |
|---|------|--------|--------|
| 2 | **Reported By** shows "manual entry" in Edit instead of typed value | BACKLOG #1 | Edit Incident should show the value the user entered. |
| 3 | **Dispatch notes and Callback Number** do not save in Edit | BACKLOG #2 | Persist and display when editing incident. |
| 4 | **Times: military (24h)** not AM/PM app-wide | BACKLOG #3 | NERIS, Incidents, etc. — all time fields 24-hour. |
| 5 | **Incidents Setup – Edit Reported By** layout spills into Assigned Units | BACKLOG #4 | Fix layout so controls are visible and don’t overlap. |
| 6 | **Initial dispatch code** – define source (NERIS / CAD / blank) | BACKLOG #5 | Document and implement mapping. |
| 7 | **AID GIVEN/RECEIVED** – Aid departments from NERIS, grouped by state (e.g. FD29081313) | BACKLOG #6 | List from Department Resources; ensure mutual-aid departments appear. |
| 8 | **Aid Department:** do not allow selecting tenant’s own department (exclude or grey out) | BACKLOG #10 | UI: exclude or disable self in list. Server already strips. |
| 9 | **Required-if:** FIRE module when fire + auto aid given | BACKLOG #7 | Confirm NERIS rules; adjust client validation. |
| 10 | **Resources UNIT TYPE** – show Apparatus value, not placeholder | BACKLOG #8 | Pull from Department Details Apparatus. |
| 11 | **Resources Populate Date** – dates only for dispatch/en route/on scene/clear; add Returning | BACKLOG #9 | Fix button behavior; add Returning field(s). |

---

## Validate / Export and roles (later tasks)

| # | Item | Source | Notes |
|---|------|--------|--------|
| 12 | **Validate for all users; Export admin-only** (hide Export for non-admin) | LATER_TASKS Part 1 | Validate visible to all; Export button only for admin; optional API guard for export. |
| 13 | **Super admin** – hidden user type, 1–2 per account, special visibility | LATER_TASKS Part 2 | Not in UI dropdown; assign via DB or platform tool; super-admin–only fields/buttons. |
| 14 | **Admin show/hide mode** – toggle field and menu visibility per user type | LATER_TASKS Part 3 | Button to enter mode; click fields/menus to set show/hide by user type; persist and apply. |

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
| 25 | **CAD email ingest** | GO_LIVE §6, EMAIL_AND_CAD_SETUP | Set up inbox, give address to CAD Dispatch, parsing, auto-fill. **User priority:** Do this first to get the email to CAD Dispatch and run a sample import. |
| 26 | **NERIS not loading between separate browsers** | User report | Export history and NERIS report data do not appear when logging in from another browser. **Top priority after CAD email.** See expanded section and `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md`. |
| 27 | **Production endpoint checks and first controlled production export** | GO_LIVE §3.6–3.7 | Re-run tenant/context, neris/health, entity-check on prod; perform first prod export when ready. |
| 28 | **Future architecture:** per-tenant NERIS config in DB (nerisEntityId, etc.); resolve tenant by domain and load config per request | TENANT_ONBOARDING §H | Scale; keep NERIS_BASE_URL global by environment. |
| 29 | **CAD email parsing and auto-create incident** | CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN | Incident Settings (submenu) → Parsing Data; per-tenant parsing rules (A→C→B); auto-create draft incident; apparatus from Dept Details; dedupe (multiple emails → one incident); optional call sequencing. **After NERIS Phase 2/3.** |

### Expanded: NERIS cross-browser issue (#26)

- **Symptom:** In cifpdil.fireultimate.app, exports succeed in one browser. In another browser (same user, same tenant), the NERIS report does not show the same information, and no export history is shown.
- **Root cause:** NERIS export history and NERIS form drafts are stored only in **localStorage** (keys `fire-ultimate-neris-export-history` and `fire-ultimate-neris-drafts`). Each browser has its own localStorage, so a different browser has no access to that data.
- **Fix direction:** Persist NERIS export history (and optionally NERIS drafts) on the server, keyed by tenant (and user if desired). On load, fetch from API and use that as the source of truth (or merge with localStorage during migration). See **`docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md`** for code locations and implementation notes.

---

## Suggested order to prioritize

1. **CAD email ingest (#25)** — get the email to CAD Dispatch and run a sample import. Guide: **`docs/procedures/EMAIL_AND_CAD_SETUP.md`**.
2. **NERIS cross-browser (#26)** — fix NERIS report and export history not loading in a different browser. Details: **`docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md`**.
3. **Unblock go-live:** Incident Detail editable inputs (#1) — see expanded description above.
4. **High-impact UX:** Reported By and dispatch notes/callback save (#2, #3), Edit Reported By layout (#5), Aid Department no self-select (#8).
5. **App-wide consistency:** Military time (#4).
6. **NERIS correctness:** Initial dispatch code (#6), Aid departments from NERIS (#7), Required-if FIRE (#9), UNIT TYPE from Apparatus (#10), Populate Date + Returning (#11).
7. **Roles and security:** Validate for all / Export admin-only (#12), auth rate-limiting (#16).
8. **Later:** Super admin (#13), admin show/hide mode (#14), remaining P2/P3 from later-changes-backlog (#15–#24), per-tenant NERIS (#28).

---

**Sources:**  
- `docs/procedures/GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md`  
- `docs/procedures/BACKLOG_INCIDENTS_NERIS_UX.md`  
- `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md`  
- `docs/procedures/LATER_TASKS_VALIDATE_EXPORT_ROLES_AND_ADMIN_VISIBILITY.md`  
- `docs/later-changes-backlog.md`  
- `docs/procedures/TENANT_ONBOARDING_CHECKLIST.md` (§H)

Update this file as items are completed (e.g. move to a “Done” section with date).
