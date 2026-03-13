# NERIS not loading between separate browsers — findings

**Issue:** In cifpdil.fireultimate.app, exports complete successfully in one browser. When the same user logs in from another browser (or device), the NERIS report does not show the same information and no export history is shown.

**Priority:** Top priority after completing CAD email ingest. See `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md` (#26).

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

Update this doc when you implement the fix (e.g. new API routes, table names, and whether drafts are persisted server-side).
