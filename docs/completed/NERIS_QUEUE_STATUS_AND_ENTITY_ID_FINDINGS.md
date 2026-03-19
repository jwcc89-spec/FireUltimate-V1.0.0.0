# NERIS queue status and NERIS Entity ID — findings and implementation

**Date:** 2026-03-15  
**Context:** User tested cross-browser (Browser A = User, Browser B = Administrator). Queue status did not sync in Browser B (both showed Draft); opening an incident showed correct status and lock. NERIS Entity ID was blank in Browser B admin customization but populated in Browser A admin.

**Status:** Both issues are now implemented (queue status from API, NERIS settings from API). See “Implemented” sections below.

---

## 1. NERIS queue status shows "Draft" in second browser — **Implemented**

### Observed behavior

- **Browser A (User):** Test-Serverbacked3 shows "In Review", 2026-001 shows "Exported" on the NERIS queue — correct.
- **Browser B (Administrator):** NERIS queue shows both reports as "Draft". Clicking into Test-ServerBacked3 loads the form with "In Review" and locked (correct). After Unlock then Validate, queue then shows "In Review" for that incident.

### Root cause

The NERIS queue **status column is sourced only from client-side localStorage**, not from the server.

- **Code:** `getNerisReportStatus(callNumber)` in `src/App.tsx` (around line 2558) returns:
  - `readNerisDraft(callNumber)?.reportStatus` if present, else
  - `NERIS_REPORT_STATUS_BY_CALL[callNumber] ?? "Draft"`.
- **`readNerisDraft(callNumber)`** reads from **localStorage** only (`readNerisDraftStore()` → key `fire-ultimate-neris-drafts`). It does **not** call the API.
- **`NERIS_REPORT_STATUS_BY_CALL`** is a small hardcoded fallback map; it is not populated from the server.

So in Browser B:

- localStorage has no NERIS drafts (different browser).
- For every incident, `readNerisDraft(callNumber)` is `null` → status falls back to `"Draft"`.
- When you **open** an incident, the form fetches the draft from the API (`getNerisDraft(callNumber)`) and shows the correct status and lock. That does **not** update the queue list, because the queue never reads from the server.

**Conclusion:** The queue status is **client-only (localStorage)** and does not reflect server draft status in another browser or device.

### Implemented (Option B)

- **Server:** `GET /api/incidents` now loads NerisDraft for the tenant and attaches `nerisReportStatus` (from `payload.reportStatus`) to each incident; default `"Draft"` when no draft exists.
- **Client:** `IncidentCallSummary` has optional `nerisReportStatus`. `getNerisQueueFieldValue(call, "status")` returns `call.nerisReportStatus` when present, otherwise falls back to `getNerisReportStatus(call.callNumber)` (localStorage). So the NERIS queue status column reflects server state in every browser after incident list is loaded.

---

## 2. NERIS Entity ID blank in second browser (admin customization) — **Implemented**

### Observed behavior

- **Browser A (Admin):** Customization shows NERIS Entity ID populated.
- **Browser B (Admin):** Customization shows NERIS Entity ID blank. Export fails with "invalid NERIS Entity ID".

### Root cause

**NERIS export settings (including NERIS Entity ID / vendor code) are stored only in localStorage.** They are not read from or written to the API or database.

- **Code:**
  - `nerisExportSettings` in `src/App.tsx` is initialized with `readNerisExportSettings()` (around line 11531).
  - `readNerisExportSettings()` reads from **localStorage** only (key `fire-ultimate-neris-export-settings`). There is no call to the server.
  - `handleSaveNerisExportSettings` calls `writeNerisExportSettings(normalized)`, which writes only to localStorage (around 11609–11614). There is no PATCH or POST to the backend.

So:

- In Browser A, the admin sets NERIS Entity ID → saved to Browser A’s localStorage only.
- In Browser B, localStorage for that key is empty → NERIS Entity ID appears blank. Department details are fetched from the API on login and stored in a **different** key (`fire-ultimate-department-details`). The NERIS Entity ID in the **Customization** panel is the **NERIS export settings** (vendorCode), not department-details payload.

**Conclusion:** NERIS export settings (Customization: Export URL, NERIS Entity ID, headers, etc.) are **client-only (localStorage)** and do not persist to the API/DB, so they do not sync across browsers or devices.

### Implemented

- **Server:** `GET /api/neris/settings` returns tenant NERIS export settings from `DepartmentDetails.payloadJson.nerisExportSettings` (defaults when missing). `PATCH /api/neris/settings` merges request body into that object and saves. `POST /api/department-details` preserves existing `nerisExportSettings` when the request body does not include it.
- **Client:** `src/api/nerisSettings.ts` — `getNerisSettings()` and `patchNerisSettings(settings)`. On login (`session.isAuthenticated`), a `useEffect` fetches `getNerisSettings()` and updates `nerisExportSettings` state and localStorage. When the user saves Customization, `handleSaveNerisExportSettings` updates state and localStorage and calls `patchNerisSettings(normalized)`; on success it refreshes from the server response. NERIS Entity ID and other Customization fields now sync across browsers.

---

## 3. Populate Date (Resources) — fix applied

**Issue:** Clicking "Populate Date" in the Resources tab was overwriting all six time fields with the date at 00:00:00, so already-entered times were lost.

**Change made (code):**

- **Populate Date** now only updates the **date** part of each resource datetime (Dispatch, Enroute, Staged, On Scene, Canceled, Clear); the **time** part of each field is preserved.
- The date used for populating is chosen in this order:
  1. **Incident Onset Date** (Core section), if set and valid (YYYY-MM-DD).
  2. Otherwise the date from Incident time unit dispatched / call create.
  3. Otherwise the existing resource fallback date.
- Implementation: `populateResourceTimesFromDispatch` in `src/pages/NerisReportFormPage.tsx` now uses `combineResourceDateTimeFromParts(populateDatePart, formatResourceTimePart(entry[field]))` for each field so only the date changes.

No backend or schema changes. User can verify by entering times, then clicking Populate Date; times should remain, dates should update (preferring Incident Onset Date when set).
