---
name: Operations modules plan
overview: "A detailed, step-numbered plan for seven new modules: Display Board, Inventory Checklists, Apparatus and Equipment Maintenance, Timesheets and Pay, a customizable Dashboard, Policies, and Fire Prevention. Each step has a one-line summary, then an in-depth section naming the files, connection points and risks found during the code review, so another agent can pick up any step. Stage A (foundations) comes first."
todos:
  - id: branch
    content: Create branch newfeatures/planning from origin/main and set up agent-handoffs/branches/newfeatures--planning (ACTIVE_CONTEXT.md + first session note)
    status: pending
  - id: canvas
    content: Build the canvas plan (Stages A-I with step numbers, Decisions, Data safety, Parked and future tabs) using the repair-plan.canvas.tsx layout; save the repo copy as docs/plans/canvases/operations-modules-plan.canvas.tsx
    status: pending
  - id: readme
    content: Add the new canvas to docs/plans/canvases/README.md with its link and status
    status: pending
  - id: decisions
    content: Record every Decided item (Section 3) in the canvas Decided table and every Open question (Section 14) in the Still open table
    status: pending
  - id: commit
    content: Commit and push the planning docs only (no app code) and report branch and commit hash
    status: pending
isProject: false
---

# Operations Modules Plan

Branch for planning docs: `newfeatures/planning` (new, created from `origin/main`). This plan changes no app code.

How to read this plan:
- Stages are letters (A to I). Steps are numbered within a stage (A1, A2, B1 and so on).
- Each step starts with a **Summary** (one line). It is followed by **Details**: the files to read, how the parts connect today, what to build, what "done" means, and what to watch out for.
- Line numbers were checked on 2026-11-25 and drift as files change. Search by the symbol name if a line number is off.

---

## 1. Rules every agent must follow on every step

1. **Preflight:** read these before editing:
   - `cursoragent-context.md`
   - `.cursor/project-context.md`
   - `docs/agent-execution-contract.md`
   - `docs/plans/task-2-multitenant-domain-plan.md`
   - this plan

   Then restate the task, constraints, acceptance criteria and risks.
2. **Approval:** these need explicit user approval at the start of each step:
   - any Prisma schema change or migration
   - any sign-in or permission logic change
   - any new npm dependency
3. **Tenant isolation:**
   - Every new table has `tenantId` plus `@@index([tenantId])`.
   - Every route reads `const tenantId = request.tenant?.id` and returns 400 if it is missing.
   - Every Prisma query includes `tenantId` in its `where`.
   - There is no shared Prisma tenant middleware, so this is done by hand in each route. Example pattern: `prisma.incident.findFirst({ where: { id, tenantId } })`.
4. **No secrets in `DepartmentDetails.payloadJson` or the frontend.** Device keys, storage keys and pay data go in their own tables or in env vars.
5. **24-hour time everywhere** (`.cursor/project-context.md`, Time format).
6. **UI pattern codes** from `cursoragent-context.md` section 6:
   - `CLICKABLE-LIST` for record lists, with resizable and reorderable headers.
   - `DD-S` and `DD-M` for dropdowns (`NerisFlatMultiOptionSelect`, with `usePortal` inside modals).
   - `QC` for chip questions.
   - `TH-SORT` for sortable headers.
   - Custom dropdowns instead of the native `<select>`.
7. **NERIS form changes:** any field added to the NERIS form must also be added in two places:
   - the Print summary (rule 42b)
   - Admin Functions, Reporting, NERIS Required Fields (rule 42c)
8. **Verification:**
   - After every batch, run `npm run lint` and `npm run build`.
   - Add server unit tests to the `test` script in `package.json` (it lists every test file by name).
   - Run targeted API checks on each changed route.
9. **Handoff:** update `agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md` and add a session note. Report the branch and commit hash.

## 2. How the app is wired today (shared reference for all stages)

**Stack:** React 19 + Vite frontend (`src/`), one Express 5 server (`server/neris-proxy.mjs`, about 8,000 lines), PostgreSQL through Prisma 7 (`prisma/schema.prisma`). Frontend dependencies are only `react`, `react-router-dom` and `lucide-react`.

**Menus and routes:**
- **Menu list:** `MAIN_MENUS` in `src/appData.ts` (line 184).
  - Each submenu is a `NavSubmenu` (line 66): `label`, `path`, `summary`, `isBuilt`, and optional `adminOnly`.
  - Unbuilt items show "Beta" and only super admins can open them.
- **Sidebar:** `ShellLayout` in `src/App.tsx` (line 3321). It hides `adminOnly` submenus from non-admins with `isAdminOrHigher(session.role) || !submenu.adminOnly` (line 3506).
- **Routes:** `RouteResolver` in `src/App.tsx` (line 14072) is one long `if (path === ...)` chain. Unmatched submenus fall to `SubmenuPlaceholderPage` (line 14343).
  - New pages go in `src/pages/` and get one branch in `RouteResolver`.
  - Then flip `isBuilt: true` on the menu entry.
- **Existing placeholder entries to reuse:**
  - Apparatus: Units, Equipment List, Fuel Logs, Maintenance Logs, Mileage Logs.
  - File Center: Checklists, Daily Logs, E-Forms, Medical Supplies, Water Logs, Vendors, Resources.
  - Fire Prevention (lines 385-426): Fire Investigations, Pre-Plans, Inspections, Permits, Properties, Smoke Alarms.

**Server middleware order in `server/neris-proxy.mjs`:**
1. `express.json({ limit: "4mb" })` (line 102). Files must not go through JSON bodies; they go straight to storage (step A3).
2. Platform admin key check for `/api/admin/*`.
3. **Tenant resolver** (about lines 1885-1940; it sets `request.tenant` at 1911 and 1935).
   - It finds the tenant from the `TenantDomain` hostname, and `localhost` maps to the `demo` tenant.
4. **Sign-in check** (about line 1973). Routes in `PUBLIC_API_ROUTES` (`server/auth/sessions.mjs` line 19) skip it. Everything else needs a `fu_session` cookie, read by `readAuthFromRequest` (sessions.mjs line 242).
   - Requests that change data also need a matching Origin header.
5. **Permission check** (about line 2019). `permissionForRequest(method, path, body)` in `server/auth/permissions.mjs` maps each route to a key in `PERMISSIONS` (permissions.mjs lines 3-19).
   - The minimum role per key comes from defaults, or from a department override in the `RolePermission` table.
   - Roles: user 10, subadmin 30, admin 40, superadmin 50 (`permissions.mjs` lines 23-28; client copy in `src/roleHierarchy.ts`).
   - **Every new route needs a mapping in `permissionForRequest`**, or it falls to the default.

**Sessions:** `server/auth/sessions.mjs`.
- `SESSION_IDLE_MS` is 60 minutes (line 5).
- The cookie has no `maxAge`, so it is lost when the browser closes.
- Five failed logins lock the account for 15 minutes.
- A password change revokes other sessions.
- The frontend wraps fetch in `src/api/http.ts`. A 401 `AUTH_REQUIRED` fires `fire-ultimate:session-expired`, which opens `SessionReauthDialog` in `App.tsx`.
- Tests: `server/auth/sessions.test.mjs`. A test guards the public-route list.

**Department data (`DepartmentDetails.payloadJson`, one row per tenant):**
- **Keys:**
  - `masterApparatusRecords` (`DepartmentApparatusRecord`, App.tsx line 526): unitId, commonName, unitType, make, model, year.
  - `schedulerApparatusRecords`: seat rules, plus the station as a name.
  - `stationRecords` (`DepartmentStationRecord`, line 517): name, address, city, state, phones.
  - `schedulerPersonnelRecords` (`DepartmentPersonnelRecord`, line 493): name, shift, apparatusAssignment, station, userType, qualifications.
  - `userFullNames` and `userTypeLabels`.
  - `shiftInformationEntries`, `kellyRotations`, `narrativeTemplates`, `incidentsSetup`, `nerisRequiredFieldOverrides`, `sharedDepartmentSettings`.
- **Routes:** `GET /api/department-details` (server line 5768) and `POST /api/department-details` (line 5949).
  - **The POST replaces the whole JSON.** It only carries over `userFullNames`, `userTypeLabels`, `nerisExportSettings` and `sharedDepartmentSettings` when they are omitted.
  - This is why new features must not be stored here.
- **Frontend reads:**
  - `normalizeDepartmentDraft` (App.tsx line 1424) migrates legacy keys.
  - `readApparatusFromDepartmentDetails` (line 1403) feeds the NERIS unit picker.
- **Server reads:**
  - `payload.schedulerPersonnelRecords` is read directly for schedule, trade and override checks (`server/trades/eligibility.mjs`, `readTradeDepartment` at about line 416).

**Incidents and NERIS:**
- **`Incident` table** (schema line 233): `address` (free text), `incidentType`, `priority`, `assignedUnits`, `currentState` (free text, default "Draft"), `receivedAt`, `apparatusJson`, `mapReference`, soft-delete columns, `createdAt`.
  - There is no latitude or longitude.
  - Routes: `GET`/`POST /api/incidents` (lines 3882 and 3938), and `GET`/`PATCH`/`DELETE /api/incidents/:id` (3981, 4005, 4069).
  - Frontend: `getIncidentList` in `src/api/incidents.ts`.
- **CAD email in:** `POST /api/cad/inbound-email` (line 3156, public, shared secret). It creates incidents with `prisma.incident.create` (about line 3521). This is where the display board's new-call alert originates.
- **`NerisDraft` table** (schema line 344): `payload` JSON keyed by `tenantId + callNumber`. `callNumber` is the incident's id: the incident list maps `reportStatusByCall.get(row.id)` (server about line 3925).
  - Routes: `GET`/`PATCH`/`DELETE /api/neris/drafts/:callNumber` (lines 4637, 4698, 4827), history at 4665 and unlock at 4772.
- **Report status** is `payload.reportStatus`: `Draft`, `In Review` or `Exported` (`reportStatusOf`, server line 4418). The form locks at In Review (`NerisReportFormPage.tsx` line 533).
- **Change log:** `NerisReportChange` and `recordReportChange` (server line 4521) store changed field names only.
- **NERIS form:** `src/pages/NerisReportFormPage.tsx` (about 8,500 lines). Field metadata is in `src/nerisMetadata.ts`.
  - Field `inputKind` values: text, date, time, datetime, textarea, select, multiselect, readonly.
  - `requiredIf` supports conditions.
  - Location fields: `incident_location_address`, `incident_location_street` and so on (about line 1516).
  - The custom **Person/Owner module** `personOwner`: `person_owner_*` fields at lines 2428-2449, covering person and owner names, business name, phone, and address. It is not part of the NERIS export.
  - **Resources:** `ResourceUnitEntry` (form line 214) has `unitId`, `staffing`, `dispatchTime`, `enrouteTime`, `onSceneTime`, `clearTime` and `personnel`. `personnel` is a comma-separated list of names.

**Schedule:**
- **`ScheduleAssignments` table** (schema line 220): `assignmentsJson` per `tenantId + shiftType + dateKey`.
  - Routes: `GET`/`POST /api/schedule-assignments` (lines 6032 and 6106).
- **Which shift is on today:** `shiftOccursOnDate` in `src/scheduleUtils.ts` (line 168).
- **Data shape:** `src/scheduleDomain.ts`.
- **Main page:** `src/PersonnelSchedulePage.tsx`.

**Reusable patterns:**
- **History:** `TradeRequest.historyJson` with `appendTradeHistory` (server line 6481) stores `{ at, by, action, note }`.
- **Approvals:** status plus `denialReason` on `TradeRequest` and `QualificationOverrideRequest`. Reviewer check: `canSeeAllTrades` (subadmin or higher).
- **Audit:** `AccountAuditLog` with `writeAccountAudit` (`server/auth/permissions.mjs`).
- **Template editor:** `src/pages/NarrativeBuilderAdminPage.tsx`, an admin builds templates stored in `payloadJson.narrativeTemplates`.
- **Dashboard approvals card:** `DashboardAttentionAlerts` (App.tsx about line 3987) reads `/api/qualification-overrides`.

**Migrations:** 17 timestamped folders in `prisma/migrations/` (for example `20261104180000_add_qualification_override_request`). New tables follow the same pattern, one migration per step, and go to staging before production.

---

## 3. Decided in this chat

| # | Decision |
|---|----------|
| D1 | Build order: Foundations (A), then Display Board (B), Inventory (C), Apparatus Maintenance (D), Equipment Maintenance (E), Timesheets and Pay (F) and Dashboard (G). Policies (H) and Fire Prevention (I) are not yet placed in the order. |
| D2 | New Prisma tables are approved in principle. Each one still gets approval at its step. |
| D3 | Apparatus and stations move into real records with permanent IDs. |
| D4 | Display board signs in with a paired device key: view-only, never expires, can be revoked. No username or password. |
| D5 | File storage (photos, PDFs, receipts, signatures) is in this plan, not parked. |
| D6 | Display board widgets: active incidents, on-duty crew, apparatus status, map, announcements, calendar, clock, inventory due. |
| D7 | The display board takes over the full screen, with optional sound, for new CAD calls. |
| D8 | The display board checks for updates every 15-30 seconds. Push updates are parked. |
| D9 | Inventory targets: apparatus, kits that can move, stations, or standalone. |
| D10 | Inventory item types: pass/fail, quantity against par level, expiration date, lot or seal number, reading, text, photo, signature. |
| D11 | Inventory checks have a frequency, and missed checks are flagged. |
| D12 | A failed inventory item flags the check and notifies admins. It does not create a maintenance record automatically. |
| D13 | Apparatus Maintenance and Equipment Maintenance are two separate screens built on one shared set of records. Equipment comes right after apparatus. |
| D14 | Maintenance first release: Records, Types, Vendors, PM Schedules. Compliance and Analytics come in a second wave. |
| D15 | An open maintenance record can mark an apparatus Out of Service. |
| D16 | Pay types: hourly, per call, per event, stipend, salary. A pay setup wizard picks Full-time, Paid-on-call or Combination. |
| D17 | Call pay comes from the NERIS report: per unit, clear time minus dispatch time, for each crew member on that unit. Members can also claim calls, and admins approve. |
| D18 | Clock in/out and after-the-fact entry are both available. The admin approves all of them. |
| D19 | Deductions are entered by the department. The app shows an estimated gross-to-net and exports for the payroll company. |
| D20 | Pay period is set per department. Admins see all pay, and members see only their own. |
| D21 | Dashboard: the admin sets a department default layout. Each user can customize their own and reset it. |
| D22 | Policies menu has Manual (all users), DTB's (all users) and Policy Builder (admins only). |
| D23 | Properties are the source of truth for Pre-Plans and Inspections. Owner and contacts are shared both ways with the NERIS report. |

---

## Stage A - Foundations

### A1. Move apparatus and stations into real records
**Summary:** Create `Apparatus` and `Station` tables with permanent IDs, copy the existing JSON into them, and keep old screens working.

**Details:**
- **Why:** maintenance, inventory, the display board, equipment and properties all point at an apparatus or station. Today these are names inside `payloadJson`, so a rename breaks every link, and every save replaces the whole JSON.
- **Read first:**
  - App.tsx: `DepartmentApparatusRecord` (line 526), `DepartmentStationRecord` (line 517), `normalizeDepartmentDraft` (line 1424), `readApparatusFromDepartmentDetails` (line 1403).
  - The schedule and apparatus editors in `DepartmentDetailsPage` (App.tsx, modes `personnelManagement` and others).
  - `server/trades/eligibility.mjs` and `server/trades/applySchedule.mjs`, which use apparatus names.
  - `ScheduleAssignments.assignmentsJson`, which stores apparatus names.
- **Build:**
  1. **Tables:**
     - `Apparatus`: id, tenantId, unitId, commonName, unitType, make, model, year, stationId, status (InService, OutOfService), statusReason, archivedAt.
     - `Station`: id, tenantId, name, address, city, state, phone, mobilePhone, archivedAt.
     - Both have `@@unique([tenantId, unitId])` or `@@unique([tenantId, name])`.
  2. **One-time copy:** a script in `scripts/` copies `masterApparatusRecords` and `stationRecords` into the tables for each tenant. It runs only by hand and is safe to rerun.
  3. **New routes:** `/api/apparatus` and `/api/stations` (GET, POST, PATCH, archive), under a new permission `settings.apparatus` (or the existing `settings.department`).
  4. **Compatibility:** schedule and NERIS still read names from the new tables through a helper, so `schedulerApparatusRecords` and seat rules keep working. Names in old `ScheduleAssignments` rows stay as they are.
- **Done when:** a unit can be renamed in the editor and the change shows everywhere. Old schedules and NERIS reports still display. The `demo` tenant data is intact.
- **Watch out:**
  - Do not delete the JSON keys in this step; keep them as a fallback until every reader is moved.
  - `POST /api/department-details` must not wipe anything during the transition.

### A2. Give personnel permanent IDs (can move to F1)
**Summary:** Create a `Personnel` table linked optionally to the `User` login, so pay, sign-offs and NERIS crew link to a person, not a name.

**Details:**
- **Today:**
  - The roster is `schedulerPersonnelRecords` in JSON.
  - Logins are the `User` table (username, role only), with display names in `payloadJson.userFullNames`.
  - NERIS crew is a comma-separated name list (`ResourceUnitEntry.personnel`).
- **Build:**
  - `Personnel` table: id, tenantId, userId (optional), fullName, shift, stationId, apparatusId, qualifications, employmentType (set in F1), archivedAt.
  - A copy script, the same approach as A1.
  - A matcher that turns NERIS crew names into personnel ids. It is used in F4.
- **Watch out:** trades and qualification overrides read personnel by name on the server (`server/trades/eligibility.mjs`). Keep a name-based read until they move.

### A3. File storage
**Summary:** Add tenant-safe file storage (Cloudflare R2 recommended) with direct browser uploads and an `Attachment` table.

**Details:**
- **Today:** there is no file storage. The only upload is the logo, stored as a base64 string in `sharedDepartmentSettings.logoDataUrl`, and the JSON body limit is 4 MB (server line 102).
- **Build:**
  1. **Settings:** storage credentials in env vars only (`.env.server`, never the frontend), for example `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET`. Uses the S3-compatible SDK (a new dependency).
  2. **`Attachment` table:** id, tenantId, ownerType (for example MaintenanceRecord, InventoryCheck, Policy, Property), ownerId, fileName, contentType, sizeBytes, storageKey, uploadedBy, createdAt, deletedAt.
  3. **Upload flow:**
     - `POST /api/attachments/upload-url` returns a short-lived signed upload URL.
     - The browser uploads straight to storage.
     - `POST /api/attachments` confirms the upload.
     - `GET /api/attachments/:id/url` returns a short-lived signed view link.
     - Storage keys always start with the tenant id, for example `t/<tenantId>/...`. The server checks `tenantId` before signing.
  4. **Limits:** allowed types (images, PDF) and a size limit per file.
- **Watch out:** never serve files from a public bucket, and never trust an id from the browser without checking the tenant.

### A4. Shared building blocks
**Summary:** Add a notifications table, a comments pattern and new permission keys used by later stages.

**Details:**
- **`Notification`:** id, tenantId, userId (or role target), kind, title, link, readAt.
  - Shown on the dashboard and in a bell menu.
  - Used by C5 (failed checks), D, F (approvals) and H (DTB's).
- **Comments:** a `Comment` table (ownerType, ownerId, body, authorId), or a history JSON like `appendTradeHistory`. A table is recommended, so comments can be searched.
- **New keys in `PERMISSIONS`** (`server/auth/permissions.mjs`), each mapped in `permissionForRequest`:
  - `displays.manage`
  - `inventory.complete`, `inventory.manage`
  - `maintenance.submit`, `maintenance.manage`
  - `timesheets.submit`, `timesheets.approve`
  - `pay.view`, `pay.manage`
  - `policies.manage`
  - `prevention.manage`
- **Admin screen:** add the keys to `src/RolePermissionsPanel.tsx` so departments can change minimum roles.

---

## Stage B - Display Board

### B1. Display setup screen
**Summary:** Admin Functions gets a "Displays" submenu where admins create boards, choose a station and arrange widgets.

**Details:**
- **Menu:** add `{ label: "Displays", path: "/admin-functions/displays", adminOnly: true, isBuilt: true }` to the Admin Functions entry in `MAIN_MENUS`, and add a branch in `RouteResolver`.
- **Tables:**
  - `DisplayBoard`: id, tenantId, name, stationId, layoutJson (widget list with grid position and size), alertSettingsJson (takeover seconds, sound on or off), updatedBy.
- **Grid editor:** the same editor the dashboard uses in G1. Build the widget grid here first, so G reuses it.
- **Needs:** A1 (stations).

### B2. Device pairing and the view-only device key
**Summary:** Pair a TV to a board with a short code. The device gets a long-lived, revocable, view-only key.

**Details:**
- **Flow:**
  1. The TV opens `https://<dept-host>/display/pair` and shows a 6-character code.
  2. The admin types the code in Displays and picks a board.
  3. The TV receives a random key and stores it in its browser storage.
- **Table:** `DisplayDevice`: id, tenantId, boardId, label, keyHash (SHA-256, like `Session.tokenHash`), pairedBy, pairedAt, lastSeenAt, revokedAt.
- **Server:**
  - Add `POST /api/display/pair/start`, `POST /api/display/pair/claim` and `GET /api/display/feed` to `PUBLIC_API_ROUTES` (`server/auth/sessions.mjs` line 19) on purpose.
  - Update the public-route test in `server/auth/sessions.test.mjs`.
  - These routes check the device key header instead of a session, and **must only ever read**. The device key must never reach any write route.
  - The tenant still comes from the host, through the normal tenant resolver.
- **Admin controls:** list the devices with last-seen time, revoke a device, re-pair a device.
- **Watch out:**
  - This is a sign-in change, so it needs explicit approval.
  - Don't reuse `fu_session`, so the 60-minute idle limit and password changes don't affect the board.

### B3. Display page and update loop
**Summary:** `/display/:boardId` is a full-screen page with no sidebar that checks `GET /api/display/feed` every 15-30 seconds.

**Details:**
- **Routing:** render the page outside `ShellLayout`, in the top-level router in App.tsx (near the catch-all `<Route>` around line 14746), so it never shows the login or session-expired dialog.
- **Feed:** one call returns everything the board's widgets need (incidents, crew, apparatus status, announcements, checks due) plus a `serverTime`. If the server is unreachable, the page keeps showing the last good data with a "last updated" time.
- **TV hardware:** document browser kiosk settings for a smart TV, Chromebox or Fire Stick in the handoff, not in code.

### B4. New-call takeover alert
**Summary:** When the feed shows a new incident since the last check, the screen takes over with call details and optional sound, then returns.

**Details:**
- **Source:** incidents created by CAD email (`POST /api/cad/inbound-email` at line 3156, `prisma.incident.create` at about line 3521) or by hand (`POST /api/incidents`).
- The feed returns incidents with `createdAt` after the device's last check.
- **Shown:** type, address, assigned units (`assignedUnits`), received time in 24-hour format.
- **Watch out:** browsers block sound until someone taps the screen once. The pair screen asks for one tap to unlock sound.

### B5. Widget library (shared with the Dashboard)
**Summary:** Build widgets as standalone components in `src/widgets/`, each with its own data needs, so both the display board and the dashboard use them.

**Details:**
- **Clock:** large 24-hour clock and date.
- **Active incidents:**
  - Reads `Incident` filtered by `currentState`, which is free text today. The list of "active" states must be defined (see open questions).
  - Soft-deleted incidents are excluded.
- **On-duty crew:**
  - Uses `shiftOccursOnDate` (`src/scheduleUtils.ts` line 168) to find today's shift.
  - Reads `ScheduleAssignments` for that `shiftType` and `dateKey`.
  - Filters to the board's station. Seats are per apparatus, so this needs the apparatus-to-station link from A1.
- **Apparatus status:** from the `Apparatus.status` column (A1). It is set by hand at first and by maintenance in D4.
- **Announcements:** a new `Announcement` table (tenantId, title, body, stationId optional, startsAt, endsAt). Admins edit announcements in Displays.
- **Calendar:** the Calendar module is not built. At first this widget shows schedule and training items only.
- **Inventory due:** turned on after C4.
- **Map:** built in B6.

### B6. Mapping platform (base map, address lookup, directions)
**Summary:** Choose the map provider and build one shared `MapView` component that the display board, dashboard, incidents, hydrants, properties and pre-plans all use.

**Details:**
- **Today:** there is no map library. These are all placeholders:
  - the incident detail "Live Map" (App.tsx, about line 5574)
  - the Hydrants map (`src/HydrantsAdminPage.tsx` lines 50-60)
  - the menu entries Incidents / Mapping, Map View and Map Markers (`isBuilt: false` in `src/appData.ts`)
- **Recommended design** (Google-style map, but legally safe coordinates):
  1. **Base map that users see:** Google Maps JavaScript API, through the Google-maintained React wrapper `@vis.gl/react-google-maps`.
     - Constantly updated roads and satellite imagery, plus Street View.
     - About 10,000 free map loads a month, then about $7 per 1,000 (pricing checked 2026-11-25).
     - A display board TV loads the map once and then only refreshes data, so it counts as one load per page load, not one per poll.
  2. **Coordinates we save in our own database** (properties, hydrants, incidents, markers): these must **not** come from Google geocoding.
     - Google's terms allow keeping Google latitude and longitude for only 30 days. They also forbid using Google content as input for point-in-polygon checks, which is what geofences do.
     - Use a lookup service that allows permanent storage instead:
       - **US Census Geocoder:** free, US addresses only, less precise in rural areas.
       - **Mapbox Permanent Geocoding:** about $5 per 1,000, no free tier.
       - **The county's GIS address points:** free and the most accurate, if the county shares them.
     - Always allow a **manual pin drag** to fix the exact spot. A pin a person places is the department's own data.
  3. **Directions for responders:** an "Open directions" button that opens a Google Maps link on the phone or computer (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`). This is free and needs no key.
     - In-app turn-by-turn routes (Google Routes API: 10,000 free a month, then about $5 per 1,000) are parked.
- **Other provider options**, kept behind one `MapView` wrapper so the provider can be swapped later:
  - **Mapbox GL JS:** 50,000 free map loads a month, permanent geocoding allowed, 100,000 free directions requests. No Street View.
  - **MapLibre or Leaflet with a commercial tile provider:** for example MapTiler or Stadia. Cheapest, but less polished imagery.
  - **Esri ArcGIS:** many counties already publish fire districts, parcels and hydrants there. Good for importing layers (see B8).
- **Settings and key:**
  - One platform-wide Google Maps browser key, restricted to the app's domains, in an env var.
  - Never a department-level secret in `payloadJson`.
- **Table changes:** add `latitude`, `longitude`, `geocodeSource` (census, mapbox, county or manual) and `geocodedAt` to `Incident`, `Property`, hydrants and markers.
  - Coordinates are filled in by the server, from the CAD route (about server line 3521) and `POST /api/incidents` (line 3938).
- **Verify before building:** have the department or a lawyer confirm the Google terms reading. Google's support says it can't give legal advice. Re-check pricing at [Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing) and [Mapbox pricing](https://www.mapbox.com/pricing).

### B7. Overlays (map markers and layers)
**Summary:** Department-defined map overlays that can be turned on and off: incidents, properties, pre-plans, hydrants, geofences and custom markers.

**Details:**
- **Layer list:** each overlay is a layer with a toggle, a legend, and an icon or color.
  - Incidents (active ones on the display board, all on the map page)
  - Properties (I1)
  - Pre-plans (I4)
  - Hydrants (when the Hydrants page is built)
  - Geofences (B8)
  - Custom markers: Knox box, gate codes, hazmat sites, water points, landing zones, staging areas
- **Custom marker table:** `MapMarker`: tenantId, markerTypeId, latitude, longitude, label, notes, linked propertyId (optional), attachmentIds.
  - `MapMarkerType`: tenantId, name, icon, color.
- **Screens:**
  - **Incidents / Mapping, Map Markers** (existing placeholder): manage markers and marker types.
  - **Map View** (existing placeholder): the full department map with every layer toggle.
- **Clicking a marker** shows a small card. A property marker links to the property's main screen (I2).

### B8. Geofences (department-drawn areas)
**Summary:** Admins draw their own areas on the map (first-due districts, station areas, subsections, mutual aid lines, hazard zones). The app uses them to tag incidents and properties automatically.

**Details:**
- **Drawing tool:** **Terra Draw** (free, MIT license). Google removed its own drawing tool in May 2026 and points to Terra Draw as the replacement. It works with Google Maps, Mapbox, MapLibre and Leaflet, so drawings survive a provider change.
  - Shapes: polygon, rectangle, circle and line.
  - Shapes can be edited, renamed, colored, nested and archived.
- **Import:** bring in existing boundaries from the county or state as GeoJSON, KML (from Google Earth) or an Esri shapefile, so admins don't have to trace by hand.
- **Table:** `Geofence`: tenantId, name, kind (district, station area, subsection, mutual aid, hazard, custom), parentId (subsections inside larger areas), geometry (GeoJSON), color, archivedAt.
- **Point-in-polygon checks:** "which areas is this point in?" is answered on the server with **Turf.js** (`@turf/boolean-point-in-polygon`).
  - PostGIS (a Postgres add-on) is a later option if there are thousands of areas. It would need a database change approval.
  - These checks only use coordinates from our own lookup service or a manual pin, never Google coordinates.
- **What geofences drive:**
  - Auto-filling `Incident.stillDistrict` (an existing column, schema line 241) when a CAD incident arrives.
  - Tagging properties with their district for inspection lists.
  - Display board filters (only calls in this station's area).
  - Dashboard filters by district.
  - Later: alerts for calls inside hazard zones.
- **Menu:** Incidents / Mapping gets a "Geofences" submenu (`adminOnly`), or it lives inside Map View with an Edit mode for admins.

---

## Stage C - Inventory Checklists

### C1. Kits registry
**Summary:** Add movable kits (drug box, airway bag) that can be assigned to an apparatus or station, with every move recorded.

**Details:**
- **Tables:**
  - `Kit`: tenantId, name, kitType, serialOrSeal, currentApparatusId or currentStationId, status.
  - `KitMove`: kitId, from, to, movedBy, at.
- **Menu:** reuse File Center, Medical Supplies (`isBuilt: false` today), or add a submenu under Checklists.

### C2. Checklist template builder
**Summary:** An admin screen to build checklist templates from sections and items of eight types, with version history.

**Details:**
- **Reference patterns:**
  - Field kinds and `requiredIf` in `src/nerisMetadata.ts` (lines 18-58).
  - The template editor in `src/pages/NarrativeBuilderAdminPage.tsx`.
- **Tables:**
  - `ChecklistTemplate`: tenantId, name, targetKind (apparatus, kit, station, none), activeVersionId.
  - `ChecklistTemplateVersion`: templateId, version, itemsJson, publishedAt.
- **Item types and their settings:**
  - pass/fail/N-A
  - quantity with a par level
  - expiration date, with a "warn within N days" setting
  - lot or seal number
  - numeric reading, with a unit and an optional minimum or maximum
  - text
  - photo (uses A3)
  - signature
- **Versions:** editing a published template creates a new version. Past checks keep their version.

### C3. Assign templates and set frequencies
**Summary:** Attach a template to one or more targets with a frequency.

**Details:**
- **Table:** `ChecklistAssignment`: templateId, target (apparatusId, kitId, stationId or none), frequency (shift, daily, weekly, monthly), dueTime (24-hour), active.
- **"Every shift"** uses the department's shift rules in `shiftInformationEntries` (`src/scheduleDomain.ts`).
- **Watch out:** departments without shifts (paid-on-call) should use daily or weekly.

### C4. Completing a check
**Summary:** Crew members open a due check, fill in each item, sign and submit. Shortages, expirations and failures are flagged automatically.

**Details:**
- **Table:** `ChecklistSubmission`: tenantId, assignmentId, templateVersionId, target, completedBy (A2 personnel id), startedAt, completedAt, resultsJson, status (Passed, Flagged), signatureAttachmentId.
- **Page:** File Center, Checklists (`/file-center/checklists`, `isBuilt: false` today), with Due, Missed and Completed lists. Layout should work on a tablet.
- **Display board:** the "checks due" widget (B5) counts assignments due today with no submission.
- **Expiring soon:** a list built from the expiration items in the latest submissions.

### C5. Failure notifications
**Summary:** A flagged submission notifies admins through the A4 notifications. It does not create a maintenance record.

---

## Stage D - Apparatus Maintenance

### D1. Shared maintenance tables
**Summary:** One set of tables serves both the Apparatus and Equipment screens.

**Details:**
- **`MaintenanceRecord`:** tenantId, recordNumber (for example MR-2026-0001, numbered per tenant per year), assetKind (apparatus or equipment), assetId, typeId, status (Open, Assigned, In Progress, Completed, Cancelled), priority, dueDate, completedDate, stationId, locationDetails, performedByKind (personnel or vendor), performedById, description, outOfService (true or false), deletedAt.
- **Supporting tables:**
  - `MaintenanceType`: tenantId (empty for system defaults), name, category, nfpaStandard, defaultFrequency, enabled.
  - `Vendor`: tenantId, name, contact, phone, email, website, services.
  - `MaintenanceCost`: recordId, description, amount, vendorId.
  - Comments from A4 and attachments from A3.
- **Seed data:** the system types from the screenshot list. For example Aerial Ladder/Device Test (NFPA 1911, annual), Breathing Air Quality Test (NFPA 1989, quarterly), Hose Pressure Test (NFPA 1962, annual), Ground Ladder Test (NFPA 1932, annual), Fire Extinguisher Inspection (NFPA 10, annual), Filter Replacement (quarterly), Brake Service, Battery Replacement and Electrical Repair.

### D2. Maintenance records screen and form
**Summary:** Apparatus, Maintenance Logs becomes a list with filters and a record form matching the screenshots.

**Details:**
- **List:**
  - Filter tabs: My Open, Open, Overdue, Complete, All.
  - A types tree on the left.
  - Columns: Record #, Description, Category, Assets.
  - Uses the `CLICKABLE-LIST` pattern with resizable and reorderable headers.
- **Form tabs:** Details, Costs, Attachments, with Comments on the side. The fields are the ones in D1.
  - Assets are picked from the A1 `Apparatus` table.
  - "Performed by" is a person (A2) or a vendor (D3).
  - Dates are entered as MM/DD/YYYY, and times in 24-hour format.
- **Permissions:** any user with `maintenance.submit` can create a record. Closing or deleting one needs `maintenance.manage`.

### D3. Types and Vendors screens
**Summary:** Turn system types on or off and add custom ones. Keep one vendor list shared with Equipment.

### D4. Out of Service link
**Summary:** Saving an open record with "Out of Service" checked sets `Apparatus.status` to OutOfService. Completing the record sets it back unless another open record still holds it out.

**Details:**
- Feeds the display board status widget (B5).
- Should also show on the Personnel Schedule apparatus row (`src/PersonnelSchedulePage.tsx`) as a badge only, with no change to seat logic.

### D5. PM Schedules
**Summary:** Recurring rules create due records automatically and flag overdue ones.

**Details:**
- **Table:** `PmSchedule`: name, typeId, assetKind, assetId or assetType, frequency, nextDueAt, active.
- **When rules run:** a check when the app starts and once a day (there is no job runner today), or each time the list loads. Pick one and document it.
- **Summary cards:** Active Schedules, Due This Week, Overdue.

### D6. Second wave: Compliance and Analytics
**Summary:** Compliance dashboard by NFPA standard, and analytics (status, priority, type breakdowns, cost this month or year). Planned after D1-D5 are in use.

---

## Stage E - Equipment

### E1. Equipment registry
**Summary:** Apparatus, Equipment List becomes a registry of SCBA, hose, ladders, extinguishers and monitors.

**Details:**
- **Table:** `Equipment`: tenantId, name, equipmentType, serialNumber, apparatusId or stationId, inServiceDate, status, archivedAt.

### E2. Equipment Maintenance screen
**Summary:** A second screen on the D1 tables, filtered to `assetKind = equipment`. It reuses the form, types and vendors, and uses NFPA tests such as 1852 for SCBA.

---

## Stage F - Timesheets and Pay

### F1. Pay setup wizard and person pay profiles
**Summary:** The department picks its pay model and pay period. Each person gets an employment type, rates and deductions.

**Details:**
- **Tables:**
  - `PaySettings`: tenantId, payModel (FullTime, PaidOnCall, Combination), periodType (weekly, biweekly, semi-monthly, monthly), periodAnchorDate, roundingMinutes, minimumCallHours, enabledEarningTypes.
  - `PayProfile`: personnelId, employmentType, rates per earning type.
  - `DeductionRule`: scope (everyone or one person), name, percent or flat amount, order.
- **Full-time departments** hide the self-entry and call-pay screens.
- **Visibility:**
  - `pay.view` lets admins see everyone's pay. Each member sees only their own.
  - Pay data never goes in `payloadJson`.

### F2. Time entries and approval
**Summary:** A single `TimeEntry` table with source, status and approver history, plus an admin approval queue.

**Details:**
- **`TimeEntry`:** tenantId, personnelId, source (clock, manual, call, event, stipend, salary), earningType, startAt, endAt, hours, amount, incidentId (optional), status (Draft, Pending, Approved, Denied), approvedBy, denialReason, historyJson.
- The approval pattern is the same as `TradeRequest`.
- The approvals queue also feeds a dashboard card, like `DashboardAttentionAlerts`.

### F3. Clock in/out and after-the-fact entry
**Summary:** A member clocks in and out, or enters hours later. Both create Pending entries.

### F4. Automatic call pay from the NERIS report
**Summary:** When a NERIS report reaches the agreed status, create Pending call entries for each crew member on each unit, using clear time minus dispatch time.

**Details:**
- **Where to hook in:** `PATCH /api/neris/drafts/:callNumber` (server line 4698), when `reportStatus` changes to the agreed value. `In Review` locks the form; `Exported` is set at line 4213.
- **Calculation:**
  1. Read `payload` resources. These are the `ResourceUnitEntry` items with `dispatchTime`, `clearTime` and `personnel`.
  2. Hours are clear minus dispatch, with rounding and minimum hours from F1.
  3. The date comes from the incident time fields. If the clear time is earlier than the dispatch time, the call crossed midnight.
- **People:** map names to personnel ids with the A2 matcher. Unmatched names become a "needs review" item for the admin.
- **No duplicates:** if the report is unlocked (`/unlock`, line 4772) and changed, the entries are updated in place, keyed by incident, unit and person.
- **Member claims:** "Claim a call" lets a member choose an incident and unit. It creates a Pending entry.
- **Later:** an EMS/ePCR source, once EMS is built.

### F5. Timesheet views, deductions and export
**Summary:** Admins can choose the columns of the timesheet, viewed by week, month or pay period. It shows hours by type, gross pay, estimated deductions and net, with CSV export.

### F6. Leave requests and balances (later sub-step)
**Summary:** Ties to item D4 in `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md` (hour ledger).

---

## Stage G - Customizable Dashboard

### G1. Grid layout editor
**Summary:** "Edit display" becomes drag, resize, add and remove widgets, using the grid built in B1.

**Details:**
- **Replaces** the show/hide checkbox list in `DashboardPage` (App.tsx line 4031) and the localStorage key `DASHBOARD_HIDDEN_WIDGETS_KEY` (line 3965).
- **New dependency:** `react-grid-layout` (needs approval).

### G2. Saved layouts
**Summary:** A `DashboardLayout` table holds a department default (set by admins) and each user's own layout, with "Reset to default".

### G3. Real data
**Summary:** Replace the sample `DASHBOARD_STATS` (`src/appData.ts`) with real counts.

**Details:**
- **Widgets added:** the B5 widgets plus personal ones: My Schedule, My Timesheet, Pending Approvals (F2), Checks Due (C4), DTB's Due (H) and Open Maintenance (D).

---

## Stage H - Policies

### H1. Policies menu and categories
**Summary:** A new top-level "Policies" menu with Manual, DTB's and Policy Builder (`adminOnly`). Admins add, rename, reorder and remove categories.

**Details:**
- **Menu:**
  - Add a `MainMenuId` value and a `MAIN_MENUS` entry in `src/appData.ts` with a lucide icon.
  - Mark the Policy Builder submenu `adminOnly: true` (hidden through `ShellLayout` line 3506).
  - On the server, protect builder routes with `policies.manage`.
- **Table:** `PolicyCategory`: tenantId, name, sortOrder, archivedAt.
- **Rule:** a category that still has policies can't be removed until they are moved.

### H2. Write a policy in the editor and publish it as a PDF
**Summary:** A word-style editor (for example TipTap, a new dependency) for title, number, category, effective date and review date. Publishing produces a PDF in file storage.

**Details:**
- **Tables:**
  - `Policy`: tenantId, categoryId, number, title, status, currentVersionId.
  - `PolicyVersion`: policyId, version, contentJson, pdfAttachmentId, publishedBy, publishedAt.
- **PDF creation:** use a PDF library on the server rather than a headless browser, so the Render server stays light.
- **Editing a published policy** reopens the text, and saving publishes a new version and a new PDF. Old versions are kept.

### H3. Bulk upload of existing PDFs
**Summary:** Upload many PDFs at once, then assign each one to a category with a title and number.

**Details:**
- Each upload becomes a Policy whose version holds the uploaded file and no editor text.
- How these get edited later is an open question.

### H4. Manual view (all users)
**Summary:** One scrollable page of every published policy by category, with search, an in-app PDF viewer (pdf.js) and a Download button.

### H5. Assignments and DTB's
**Summary:** Individual assignments, recurring random assignments, templates such as "Rookie Policies", and the DTB's page where users acknowledge.

**Details:**
- **Tables:**
  - `PolicyAssignment`: tenantId, policyId, policyVersionId, personnelId, dueAt, source (individual, random, template), status.
  - `PolicyAcknowledgment`: assignmentId, acknowledgedAt, method. These are add-only.
  - `PolicyTemplate` and `PolicyTemplateItem`.
  - `PolicyRandomRule`: frequency, count, categoryIds, audience, lastRunAt.
- **Random picks** avoid repeating a policy until the pool is used up. The rule runs on the same daily check as D5.
- **Republishing:** the admin chooses whether everyone must acknowledge the new version.
- **Report:** who has acknowledged and who is overdue, with CSV export.

---

## Stage I - Fire Prevention

**Speech-to-text interpretation used:** "free plan", "replays" and "rep Lance" were read as Pre-Plans. "Nearest report" was read as the NERIS report, and "MS call" as an EMS call. The example address was read as Kankakee, Illinois.

**Reference screenshots:** put example screenshots of the Properties page, a property's main screen, Pre-Plans and Inspections in `docs/plans/reference-screens/fire-prevention/` before I2 and I4 start.

### I1. Properties list and map
**Summary:** Fire Prevention, Properties: entering an address creates a property. Properties show in a searchable list and as pins on the B6 map.

**Details:**
- **Table:** `Property`: tenantId, addressLine, city, state, zip, normalizedAddress (for matching), latitude, longitude, geocodeSource, districtGeofenceId (from B8), name or business, occupancyType, photoAttachmentId, archivedAt.
- **Map:** uses the shared `MapView` (B6) with the Properties overlay layer (B7). New properties are geocoded by the permanent-storage lookup service, and the pin can be dragged to the exact building.
- **Address matching:** `normalizedAddress` is unique per tenant, so the same building can't be entered twice (for example "St" and "Street" count as the same).

### I2. A property's main screen
**Summary:** A washed-out building photo in the background, with large buttons for Pre-Plan, Inspections, Property Information, Hazards, Contacts and Call History.

**Details:**
- **Table:** `PropertyContact`: propertyId, role (owner, tenant, maintenance or management), name, business, phone, address, source (manual, NERIS report), updatedAt.
- **Photo:** an A3 attachment (source is an open question).
- **Changes:** every edit is written to property history (A4 comments or history).

### I3. Call History
**Summary:** Lists every incident at this property with date, type and a link, plus counts by type (fire, EMS, alarm and so on).

**Details:**
- **Link:** add an optional `propertyId` to `Incident` (schema line 233).
  - It is set automatically when the incident's normalized address matches a property, both from CAD (about server line 3521) and from `POST /api/incidents`.
  - The officer can confirm or change it on the incident.
- **Older incidents:** a one-time match for past incidents, by normalized address.

### I4. Pre-Plans
**Summary:** One or more pre-plans per property, covering construction, occupancy, hazards, utility shutoffs, hydrants, Knox box, photos and floor plans. Exact fields come from the screenshots.

**Details:**
- **Menu:** Fire Prevention, Pre-Plans (`isBuilt: false` today) lists every pre-plan. Opening one from a property goes to that property's pre-plan.

### I5. Inspections
**Summary:** Schedule an inspection from the Inspections page (type or pick an address) or from a property. Scheduled, pending and completed inspections show on the Inspections page and on the property.

**Details:**
- **Table:** `Inspection`: tenantId, propertyId, inspectionType, scheduledAt (24-hour), inspectorId, status (Scheduled, Pending, Completed, Failed, Re-inspect), resultsJson, completedAt.
- **Form:** the inspection form and violation handling come from the screenshots. It can reuse the C2 checklist builder for inspection items.

### I6. Two-way owner and contact sharing with the NERIS report
**Summary:** The NERIS report pulls owner and contacts from the matched property. Contact info entered on the report that the property lacks is added to the property, never overwriting without confirmation.

**Details:**
- **Fields:** the NERIS Person/Owner module `personOwner` in `src/nerisMetadata.ts` (lines 2428-2449), covering owner first and last name, business, phone, and address parts. It is not part of the NERIS export, so this doesn't change what is sent to NERIS.
- **Matching:** the report's `incident_location_*` fields (`src/nerisMetadata.ts` about line 1516) are normalized and matched to a `Property`, or the incident's `propertyId` from I3 is used.
- **Property to report:** in `NerisReportFormPage.tsx`, an "Owner info found for this property: fill in?" prompt fills the `person_owner_owner_*` fields. Report data is never filled silently.
- **Report to property:** on `PATCH /api/neris/drafts/:callNumber` (server line 4698), when the owner fields are filled and the property has no owner contact, add a `PropertyContact` with source "NERIS report" and record it in property history. When the values differ, create a review item for the admin instead of overwriting.
- **Rules 42b and 42c:** if a new field is added to the NERIS form (for example a "Property" picker or a tenant or maintenance contact), add it to the Print summary and to NERIS Required Fields too.
- **Later:** the same pattern for the EMS report.

### I7. Parked
Fire Investigations, Permits and Smoke Alarms stay placeholders until they are planned.

---

## 12. New libraries (each needs approval when its step starts)

| Library | Used in | What it does | Cost and license | Alternatives |
|---|---|---|---|---|
| `@vis.gl/react-google-maps` | B6-B8, G, I | Google-maintained React wrapper for the Google map | Library free (MIT). Google usage is billed per map load after the free monthly amount. | Mapbox GL JS, MapLibre, Leaflet |
| `terra-draw` and its map adapter | B8 | Draw and edit geofence shapes, saved as standard GeoJSON | Free (MIT) | Mapbox GL Draw (Mapbox only), Leaflet-Geoman |
| `@turf/boolean-point-in-polygon` (Turf.js) | B8, I1 | Answers "which areas is this point in?" on the server | Free (MIT) | PostGIS (database add-on, needs schema approval) |
| A KML/shapefile import helper (for example `@tmcw/togeojson`, `shpjs`) | B8 | Converts county boundary files to GeoJSON | Free (BSD/MIT) | Ask the county for GeoJSON directly |
| `react-grid-layout` | B1, G1 | Drag, resize, add and remove widgets on a grid | Free (MIT) | `gridstack` |
| `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` | A3 | Signed upload and view links. Works with R2, S3 and Backblaze. | Free (Apache 2.0). Storage itself is billed by the provider. | Provider-specific SDKs |
| `@tiptap/react` with the starter kit | H2 | Word-style editor: headings, bold, lists, tables, images | Core free (MIT). Some extensions are paid "Pro"; avoid those. | Lexical (Meta, MIT), Quill |
| A server PDF maker (`pdfmake` or `@react-pdf/renderer`) | H2, reports | Turns policy text into a PDF without a heavy headless browser | Free (MIT) | Puppeteer (heavy on Render) |
| `pdfjs-dist` (pdf.js) | H3, H4 | Shows PDFs inside the app with zoom and page scroll | Free (Apache 2.0, by Mozilla) | The browser's built-in PDF viewer |
| `signature_pad` | C2, C4 (if signatures are drawn) | Draw a signature with a finger or mouse, saved as an image | Free (MIT) | Typed name plus PIN (no library) |
| `qrcode` (optional) | B2 | Shows a QR code on the TV for pairing | Free (MIT) | Typed 6-character code only |

Each new library must be checked before it is added:
- Its license allows commercial use.
- `npm run build` still passes.
- The bundle size increase is reported.
- Large libraries (maps, PDF viewer, editor) load only on the pages that use them, not on every page.

## 13. Data safety (every stage)
- Every table is tenant-scoped, and every query filters on `tenantId`.
- The `demo` tenant is never reset.
- Records are soft-deleted only: maintenance, inventory submissions, time entries, policies, acknowledgments, properties, inspections.
- Policy versions, acknowledgments and inventory submissions are add-only.
- Device keys are stored only as hashes and can be revoked. Display routes only read.
- Pay data and storage credentials are never stored in `payloadJson` or the frontend.
- Saved coordinates never come from Google geocoding. They come from a lookup service that allows permanent storage, or from a manual pin. The map key is restricted to the app's domains.
- NERIS export payloads are unchanged by every stage. Owner and contact sharing uses only the custom Person/Owner module.
- Schema changes are tested on staging before production. Every copy script is safe to rerun and runs only by hand.

## 14. Open questions (all unanswered, numbered for replies)

**General**
- Q1. File storage provider: Cloudflare R2 (recommended), AWS S3 or Backblaze B2?
- Q2. Approve, in principle, the libraries in Section 12, each still confirmed when its step starts?
- Q3. Personnel IDs (A2): do them in Stage A, or wait until Stage F?
- Q4. Admin notifications: in-app only, or email too?
- Q5. Where do Policies (H) and Fire Prevention (I) go in the build order?

**Display Board**
- Q6. Which incident `currentState` values count as "active" or "open", and when does an incident drop off the board?
- Q7. Map provider: Google Maps for the visible map (recommended), Mapbox, or a free open map?
- Q7a. Address lookup for saved coordinates: US Census (free), Mapbox Permanent (paid), or the county GIS address points? This can differ per department.
- Q7b. Which geofence types do departments need first: first-due districts, station areas, subsections, mutual aid lines, hazard zones?
- Q7c. Do your counties publish boundary files (GeoJSON, KML or shapefile) to import, or will admins draw them by hand?
- Q7d. Should geofences fill in the incident's district automatically and filter the display board to that station's area?
- Q8. Can one board be shown on several TVs, and can one station have several boards?
- Q9. Default takeover length for a new call (for example 60 seconds), and is sound on by default?

**Inventory**
- Q10. Signature method: drawn on screen, or typed name plus PIN?
- Q11. Who completes checks (any user?) and who builds templates (admin or subadmin)?

**Maintenance**
- Q12. Can any user create a maintenance record, with only admins able to close it?

**Timesheets and Pay**
- Q13. Which NERIS status creates call pay: "In Review" (report submitted for review) or "Exported" (sent to NERIS)?
- Q14. Should the app calculate overtime? If yes, which rule (40-hour week, or the fire-specific FLSA 7(k) work period)?
- Q15. Is there a payroll company the export should match (for example QuickBooks, ADP or Paychex), or is a general CSV fine?
- Q16. Can members see the deduction lines on their own pay, or only the gross?

**Policies**
- Q17. Editing uploaded PDFs: replace with a new PDF, convert into the editor (recommended), or edit the PDF itself (paid library)?
- Q18. What does "DTB" stand for?
- Q19. Is acknowledgment one click, or a typed name or PIN?
- Q20. When a policy is republished: must everyone re-acknowledge automatically, or does the admin choose each time?

**Fire Prevention**
- Q21. Confirm the speech-to-text readings above (Pre-Plans, NERIS, EMS, Kankakee).
- Q22. Building photo: uploaded by the department (free, stored), or shown live from Google Street View (billed per image, and Google's terms don't allow saving the image)?
- Q23. Bulk-import properties from a spreadsheet (county assessor or business list)?
- Q24. Keep Fire Investigations, Permits and Smoke Alarms parked?
- Q25. Besides the owner, should tenants and building maintenance contacts also be added to the NERIS form? That adds new form fields, which also need Print summary and Required Fields support.
