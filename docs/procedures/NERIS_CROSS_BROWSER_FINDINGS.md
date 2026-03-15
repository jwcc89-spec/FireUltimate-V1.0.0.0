# NERIS not loading between separate browsers — findings

**Issue:** In cifpdil.fireultimate.app, exports complete successfully in one browser. When the same user logs in from another browser (or device), the NERIS report does not show the same information and no export history is shown.

**Priority:** Top priority after completing CAD email ingest. See `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md` (#26).

**Phase 1 (export history on server) is implemented.** The app now stores NERIS export history in the database and loads it when you log in, so export history appears in every browser. You only need to **run the database migration once** (see “Steps for you” below). **Phase 2** (server-side drafts so a half-finished report can be loaded in any browser/device) is **mandatory** for this build. **Phase 3** (validation/export locking: validated = locked to users unless subadmin+ unlocks; exported = locked, subadmin+ can unlock; only subadmin+ can export) is also required.

---

## Confirmed behavior

- **Incident list:** Loads correctly in the second browser (user-confirmed). The list comes from `GET /api/incidents` after login, so tenant/auth and API are fine.
- **Not visible in second browser:** Export history and NERIS report/form data (drafts, populated form). Those are the only pieces that need a fix.

---

## Root cause

NERIS-related data that should be visible across browsers is stored only in **client-side localStorage**, which is per-origin and per-browser. A different browser has its own empty localStorage, so it never sees:

1. **Export history** — list of past NERIS exports (call number, time, status, etc.).
2. **NERIS form drafts** — per-incident form state (field values, report status, aid entries, etc.).

The **incident list** is loaded from the API and appears in all browsers; no change needed there.

---

## Code locations

### Export history (localStorage only)

| What | Location | Key / behavior |
|------|----------|----------------|
| Storage key | `src/App.tsx` | `NERIS_EXPORT_HISTORY_STORAGE_KEY = "fire-ultimate-neris-export-history"` |
| Read | `src/App.tsx` | `readNerisExportHistory()` — reads from localStorage, returns `NerisExportRecord[]` |
| Write | `src/App.tsx` | `writeNerisExportHistory(history)`, `appendNerisExportRecord(record)` |
| Used by | NERIS Exports page, NERIS Export Details | Passed via context/props; no server fetch |

After a successful (or failed) export, the client calls `appendNerisExportRecord(record)` and the record is stored only in localStorage. There is no API that persists or returns export history.

### NERIS drafts (localStorage only)

| What | Location | Key / behavior |
|------|----------|----------------|
| Storage key | `src/App.tsx` | `NERIS_DRAFT_STORAGE_KEY = "fire-ultimate-neris-drafts"` |
| Read | `src/App.tsx` | `readNerisDraftStore()`, `readNerisDraft(callNumber)` |
| Write | `src/App.tsx` | `writeNerisDraftStore(store)`, `writeNerisDraft(callNumber, draft)` |
| Used by | `NerisReportFormPage` | Form state is initialized from `readNerisDraft(callNumber)`; no server fetch |

Drafts are keyed by incident call number. Structure includes `formValues`, `reportStatus`, `lastSavedAt`, `additionalAidEntries`, `additionalNonFdAidEntries` (see `NerisStoredDraft` in `App.tsx`).

### Incident list (API + localStorage cache)

| What | Location | Behavior |
|------|----------|----------|
| API | `src/api/incidents.ts` | `getIncidentList(false)` → `GET /api/incidents` |
| App state | `src/App.tsx` | `incidentCalls` state; initial value from `readIncidentQueue()` (localStorage), then after login `getIncidentList(false)` runs and overwrites with API response; result is also written to localStorage via `writeIncidentQueue(list)` |

So in a new browser: initial `incidentCalls` is empty (no localStorage). After login, `useEffect` runs and calls `getIncidentList(false)`. If that succeeds, the list should populate. If the list is still empty in the other browser, the next step is to confirm whether `/api/incidents` is called and what it returns (e.g. tenant from host/cookie, 200 vs error).

---

## Recommended fix direction

### 1. Export history (high impact, clear scope)

- **Persist on server:** Add a store for “NERIS export records” keyed by tenant (and optionally user). Options: new table (e.g. `NerisExportRecord`) or a JSON column on an existing tenant/incident-related table.
- **API:**  
  - `GET /api/neris/export-history` — return list of export records for the current tenant (and optionally user).  
  - On each export (success or failure), the server or client records the result. Prefer server: after the app calls `POST /api/neris/export`, the server can append the record when it gets the NERIS response. Alternatively, the client can call a `POST /api/neris/export-history` (or include in export response) to append the record.
- **Client:** On load (when authenticated), fetch export history from the API. Use that as the source of truth for the NERIS Exports / Export Details UI. Optionally keep writing to localStorage for a transition period, then phase out or use only as offline cache.

### 2. NERIS drafts (optional, larger scope)

- **Option A — Server-side drafts:** Persist draft state per incident (and tenant/user) in the DB. Add GET/PATCH (or POST) for “NERIS draft for incident X”. Form load: if no local draft, fetch from API; on save, PATCH to API and optionally keep localStorage in sync. This gives full cross-browser draft sync.
- **Option B — No server drafts:** Keep drafts in localStorage only. Improve “empty form” behavior: when opening the NERIS form for an incident, if there is no local draft, ensure incident summary is loaded from the API (e.g. `getIncident(callNumber)`) and used to prefill basic fields. That way at least incident-level data appears in the other browser; only draft edits would still be local.

Recommendation: implement **export history** server-side first (fixes “no export history” in other browser). Then decide whether to add **server-side drafts** (Option A) or only improve prefilling from incident API (Option B).

---

## Data shapes (for server persistence)

- **NerisExportRecord** (see `App.tsx` interface): `id`, `callNumber`, `incidentType`, `address`, `exportedAtIso`, `exportedAtLabel`, `attemptStatus`, `httpStatus`, `httpStatusText`, `statusLabel`, `reportStatusAtExport`, `validatorName`, `reportWriterName`, `submittedEntityId`, `submittedDepartmentNerisId`, `nerisId`, `responseSummary`, `responseDetail`, `submittedPayloadPreview`. All can be strings (or numbers where noted).
- **NerisStoredDraft** (per call number): `formValues` (record of field ids to string values), `reportStatus`, `lastSavedAt`, `additionalAidEntries`, `additionalNonFdAidEntries`. Stored as a map keyed by `callNumber`.

---

## Verification after fix

1. In Browser A: log in to cifpdil.fireultimate.app, run a NERIS export for an incident.
2. In Browser B (or incognito): log in to the same tenant. Open NERIS Exports (or equivalent). Export history should list the export from Browser A.
3. If drafts are persisted: open the same incident’s NERIS report in Browser B; form should show the same draft state as in Browser A (or the last saved server state).

---

## Implementation plan (next steps)

**Goal:** Persist all NERIS-related data on the server so it’s visible in every browser/device. Do **export history** first (high impact, clear scope), then **drafts** (optional).

### Phase 1: Export history (server as source of truth)

1. **Database**
   - Add a `NerisExportRecord` (or `NerisExportHistory`) table, scoped by `tenantId`.
   - Columns: mirror the client’s `NerisExportRecord` (id, callNumber, incidentType, address, exportedAtIso, exportedAtLabel, attemptStatus, httpStatus, httpStatusText, statusLabel, reportStatusAtExport, validatorName, reportWriterName, submittedEntityId, submittedDepartmentNerisId, nerisId, responseSummary, responseDetail, submittedPayloadPreview). Use `id` as server-generated (e.g. cuid); add `tenantId` and `createdAt`.
   - Run Prisma migration.

2. **API**
   - **GET /api/neris/export-history** — Resolve tenant from request (host/tenant middleware). Return list of export records for that tenant (newest first). Optionally support `?limit=` and `?offset=` for pagination.
   - **POST /api/neris/export-history** — Body: same shape as client’s `NerisExportRecord` (id optional; server can generate). Resolve tenant; insert row with `tenantId`. Return 201 and the stored record (with server id). Used by the client after each export (success or failure).

3. **Client**
   - **On load (after auth):** Fetch `GET /api/neris/export-history` and hold in app state or context. Use this as the **source of truth** for NERIS Exports list and Export Details (replace `readNerisExportHistory()` for display).
   - **After each export:** Call `POST /api/neris/export-history` with the same record object the client currently passes to `appendNerisExportRecord()`. Optionally keep calling `appendNerisExportRecord()` for a short transition (e.g. offline cache), then remove localStorage write once server is authoritative.
   - **NerisReportFormPage** and any page that uses `readNerisExportHistory()` should read from the server-backed list (e.g. context or prop from App that holds export history from API).

4. **Verification**
   - Export in Browser A → open same tenant in Browser B → export history shows the new export. No dependency on localStorage.

### Phase 2: NERIS drafts on server (mandatory)

**Requirement:** A user who gets halfway through a report must be able to load and finish it in any other browser or computer. Drafts must persist on the server.

- Add table/store for “NERIS draft per incident” (tenantId + incident callNumber or incidentId, plus JSON or columns for formValues, reportStatus, lastSavedAt, additionalAidEntries, additionalNonFdAidEntries). Add GET/PATCH `api/neris/drafts/:callNumber` (or by incident id). Form load: fetch draft from API (server is source of truth); on save, PATCH to API and sync localStorage as cache. Full cross-browser draft sync.

### Phase 3: Validation and export locking (mandatory)

Add locking and permissions around Validate and Export so that:

1. **After Validate:** The report is **locked** for editing for users with **user** permission. They can no longer edit it unless it is **unlocked** by a **subadmin** or higher.
2. **After Export:** The report is **locked** for editing. Only a **subadmin** (or higher) can **unlock** it. **Export** is allowed only for **subadmin** and higher (not for plain “user” role).
3. **Unlock:** Subadmin (and higher) can unlock a validated or exported report so it can be edited again.

Implementation will need: report status/lock state stored (e.g. in draft or a separate lock table), role checks (user vs subadmin vs admin), and UI to show locked state and unlock action for subadmin+.

---

## Phase 1 implemented (what was done)

- **Database:** New table `NerisExportHistory` (Prisma model), migration `20260314000000_add_neris_export_history`.
- **API:** `GET /api/neris/export-history` (list for tenant), `POST /api/neris/export-history` (save one record).
- **Client:** On login, the app fetches export history from the API and uses it for the NERIS Exports and Export Details pages. After each export (success or failure), the app sends the record to the server and refreshes the list. Old localStorage export history is still used as a fallback if the server list is empty.

---

## Steps for you (run the migration once)

You only need to do this **once** so the new table exists in your database. No coding—just run one command from the project folder.

### 1. Open the project in Cursor

- In Cursor, use **File → Open Folder** (or **Open…**) and choose your **FireUltimate** project folder (the one that contains `package.json`, `prisma`, and `server`).  
- You should see the project name at the top of the left sidebar.

### 2. Open the terminal

- **Menu:** **Terminal → New Terminal** (or **View → Terminal**).  
- A terminal panel will open at the bottom. The prompt might show something like `FireUltimate-V1.0.0.0` or your machine name and the folder name.

### 3. Make sure you’re in the project root

- Look at the **last part** of the line in the terminal (the **prompt**). It often ends with the folder name, e.g. `FireUltimate-V1.0.0.0`.
- If you see **`cad-email-ingest-worker`** or any other subfolder name, type:
  ```text
  cd ..
  ```
  and press **Enter**. Repeat until the prompt shows the main project folder (e.g. **FireUltimate-V1.0.0.0**).

### 4. Make sure `.env.server` has your database URL

- In the **left file tree**, click the **project root** (top folder).
- Find the file **`.env.server`** (it may be under a “dot” or “hidden” section). If you don’t see it, look for **`.env.server.example`** and copy it, then rename the copy to **`.env.server`**.
- Open **`.env.server`** and find the line that says **`DATABASE_URL=`**.
- After the `=`, there must be your **PostgreSQL connection string** (starts with `postgresql://...`). You can copy this from your database provider (e.g. **Neon**: Neon dashboard → your project → **Connection string**).  
- If **DATABASE_URL** is empty, the migration will fail. Paste the connection string there, **save the file** (Ctrl+S or Cmd+S), then continue.

### 5. Run the migration

- In the **terminal**, **copy this entire line** (one line, no line break in the middle):
  ```text
  node --env-file=.env.server -e "require('child_process').execSync('npx prisma migrate deploy', {stdio:'inherit', env: process.env})"
  ```
- **Paste** it into the terminal (right‑click → Paste, or Cmd+V / Ctrl+V).
- Press **Enter**.
- **Success:** You should see something like:  
  `Applying migration \`20260314000000_add_neris_export_history\``  
  and then **“All migrations have been successfully applied.”**
- **If you see an error:**  
  - **“Cannot find module 'dotenv/config'”** or similar → In the project root, run `npm install dotenv` and try the migration command again.  
  - **“datasource.url property is required”** → **.env.server** is missing or **DATABASE_URL** is empty; repeat step 4.  
  - **“Can’t reach database server”** or **connection refused** → Check that **DATABASE_URL** in **.env.server** is correct and that you have internet access.

### 6. Deploy and test (staging or production)

- **If you run the API locally:** Restart the server (e.g. stop and run `npm run proxy` again) so it picks up the new table.
- **If the API runs on Render (or similar):** Redeploy the service that runs the API (e.g. push to the branch that Render builds, or use “Manual deploy” in the Render dashboard). Render uses its **own** environment variables (e.g. **DATABASE_URL**); you must run the migration **against the same database** that Render uses. So either:
  - Run the migration from your computer with **DATABASE_URL** in **.env.server** set to the **same** connection string that Render uses (so the new table is created in that database), then redeploy the API on Render; or  
  - Run the migration in a one-off shell or build step on Render if your setup supports it.
- **Test:** In **Browser A**, log in to your app (e.g. **cifpdil.staging.fireultimate.app**), go to **Reporting → NERIS**, open an incident, and run a NERIS export. Then open **Browser B** (or an incognito window), log in to the same tenant, go to **Reporting → NERIS → Exports**. You should see the export you did in Browser A. Test on **\*.staging.fireultimate.app** (or your staging host) before production.

---

Update this doc when you implement the fix (e.g. new API routes, table names, and whether drafts are persisted server-side).
