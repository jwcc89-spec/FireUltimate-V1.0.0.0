# Backlog: Incidents & NERIS Form UX (To Change Later)

Captured 2026-03-13 from production testing on cifpdil.fireultimate.app. These are **not** blocking go-live; prioritize and schedule as follow-up work.

---

## Incidents (Create / Edit)

### 1. Reported By – shows "manual entry" in Edit — **Done (2026-03)**
- **Issue:** When an incident is created and a value is manually typed (or selected from dropdown) into **Reported By**, opening **Edit Incident** showed **"manual entry"** or placeholder instead of the saved value.
- **Fix:** Incident detail no longer overwrites API `reportedBy`/`callbackNumber`/`dispatchNotes` when building detail from list. Reported By dropdown on edit now includes the saved value in options so it displays correctly (`reportedByDropdownOptions` in `App.tsx`).

### 2. Dispatch notes and Callback Number do not save — **Done (2026-03)**
- **Issue:** **Dispatch notes** and **Callback Number** did not persist; values cleared after refresh.
- **Fix:** Same root cause as #1 — detail was overwriting with empty values when built from API list. Save already sent these fields via PATCH; display now uses `detail.reportedBy`, `detail.callbackNumber`, `detail.dispatchNotes` from API. Dispatch Notes timeline supports both string and array shape.

---

## Time display: military (24h) not AM/PM — **Done (2026-03)**

- **Scope:** Times entered in any fields across the program (NERIS, Incidents, etc.) should use **military time (24-hour)**, not AM/PM.
- **Desired:** All time inputs/outputs use 24-hour format consistently.
- **Status:** **Done.** App-wide 24h time (NERIS, Incidents, and all other screens). Convention for future work: see `.cursor/project-context.md` § Time format.

---

## Incidents Setup – Edit Reported By layout (#5 in PRIORITY) — **Done (2026-03)**

- **What it refers to:** **Admin Functions → Department Details → Incidents Setup.** There is an **Edit Reported By** control that lets admins configure the **Reported By** options list (e.g. "911 Caller", "Dispatch", etc.) and the mode (fill-in vs dropdown). The **layout** of that editor (the input boxes / list of options) can spill or overlap the **Assigned Units** configuration area below it.
- **Status:** **Done.** Layout fixed so the Reported By editor is fully visible and does not overlap Assigned Units.

---

## NERIS Form – Initial dispatch code source (#6 in PRIORITY)

- **Where it is:** **`src/nerisMetadata.ts`** — `createDefaultNerisFormValues()`. The default for **`initial_dispatch_code`** is **empty string** (changed from hardcoded value).
- **Desired behavior:** Add **Initial Dispatch Code** to **Create Incident**. If that field has a value when creating an incident, populate NERIS **Initial dispatch code** from it. Otherwise leave blank (dispatch/CAD can populate later).

---

## NERIS Form – AID GIVEN / RECEIVED – Aid Department names

- **Issue:** **Aid Department name(s)** should be populated from **Mutual Aid Departments | Department Resources | Department Details | Admin Functions**. Currently the list is only grouped with "alabama" and a few departments; it should come from NERIS and list all departments **grouped by state**.
- **Example:** For a live entry where CIFPD is assisting Gilman, NERIS_ID **FD29081313** (Gilman) is not listed.
- **Desired:** Map this list to NERIS; show all departments grouped by state; ensure Gilman (FD29081313) and other mutual-aid departments appear when configured.
- **Status (2026-03-18):** **Largely done.** `GET /api/neris/entities` + Department Details **Mutual Aid** (state-grouped DD-M, NERIS + **local-only** adds). CORE **Aid department name(s)** uses configured list (NERIS + local) or full directory; UI shows **name only**; export still uses FD/FM ID for NERIS rows. Local-only choices are CORE-only (not `department_neris_id`). **Still open:** self-select exclusion below.

### Do not allow selecting the current tenant’s department (self-aid) — **Done (2026-03)**

- **Requirement:** The Aid Department list must **not** allow the user to select the **current tenant’s** department (the incident base department NERIS ID). NERIS returns 422: "Aid department NERIS ID cannot be the same as the incident base department NERIS ID."
- **Status:** **Done.** Tenant’s own department is excluded or greyed out in the UI; server already strips. (Earlier: "Current export department" synthetic option removed.)

---

## NERIS Form – "Required if" / FIRE module when auto aid given

- **Issue:** Need to verify **required-if** rules: if call type is **fire** and **auto aid** is given, the **FIRE** module may not be required.
- **Desired:** Confirm with NERIS rules and adjust client-side required validation so FIRE module is not incorrectly required in that case.
- **Status (2026-03-18):** **Implemented (client).** When **Was aid given or received?** = Yes and **Aid direction** = **Given** (mutual aid given), FIRE-module fields are **not** required (`src/nerisMetadata.ts` — `isNerisFieldRequired`). Re-validate against NERIS spec if business rules change.

---

## NERIS Form – Resources: UNIT TYPE value (#10 in PRIORITY) — **Done (2026-03)**

- **What it refers to:** In the NERIS form **Resources** section, each resource row has a **UNIT TYPE** field. It was showing placeholder "Auto-populates from unit setup" instead of the value from Department Details → Department Apparatus.
- **Status:** **Done.** Unit Type shows the **Unit Type** from Department Details → Department Apparatus for the selected responding unit. Lookup keys by both `unitId` and `commonName` so it populates whether the dropdown shows unit ID or common name. Empty when unit is not in apparatus (placeholder "—").

---

## NERIS Form – Resources: Populate Date button and Return/Avail — **Done (2026-03)**

- **Issue 1 – Populate Date behavior:** When **Populate Date** is clicked, it should only populate **dates** (preserve times) for **dispatch**, **en route**, **on scene**, **clear**; **not** staged or canceled.
- **Issue 2 – Return/Avail:** **Return/Avail** field (date + time) in **Edit Times**, between On Scene and Canceled, same styling as other times (Clear button, date, time).
- **Status:** **Done (verified).** Populate Date only updates those four fields; Return/Avail added to Edit Times and to resource unit data/header summary. Label shown as "Return/Avail".

---

## Delete Incident – do not delete NERIS report when In Review or Exported — **Done (2026-03)**

- **Issue:** When an incident is deleted, the NERIS report (draft) was also removed. If the report is **In Review** or **Exported**, it must not be deleted (regulatory/audit retention).
- **Status:** **Done (verified).** Before delete, we check NERIS report status. If **In Review** or **Exported**, incident deletion is **blocked** with message: "This incident cannot be deleted because the NERIS report is In Review or Exported. Protect the report for compliance." Applied in **both** places: (1) Delete from NERIS report form, (2) Delete from incident list/detail (report status fetched via `getNerisDraft` before calling delete).

---

## Summary table

| # | Area | Short description |
|---|------|-------------------|
| 1 | Incidents | Reported By in Edit — **Done 2026-03** (no overwrite; dropdown shows saved value) |
| 2 | Incidents | Dispatch notes and Callback save — **Done 2026-03** (same fix; PATCH already sent them) |
| 3 | App-wide | Times: military (24h) not AM/PM — **Done 2026-03** (see project-context.md) |
| 4 | Incidents Setup | Edit Reported By layout — **Done 2026-03** |
| 5 | NERIS | Initial dispatch code – add field to Create Incident; when set, populate NERIS; else blank |
| 6 | NERIS | AID GIVEN/RECEIVED – Aid departments; self-select (#10) **Done 2026-03** |
| 7 | NERIS | Required-if: FIRE + aid given (done 2026-03-18 for direction Given) |
| 8 | NERIS | Resources UNIT TYPE – **Done 2026-03** (show Dept Apparatus Unit Type) |
| 9 | NERIS | Resources Populate Date + Return/Avail – **Done 2026-03 (verified)** (dates only for dispatch/en route/on scene/clear; Return/Avail in Edit Times) |
| 10 | NERIS | Aid Department: do not allow selecting tenant's own department — **Done 2026-03** |
| 11 | Incidents + NERIS | **Delete Incident:** block when NERIS In Review/Exported — **Done 2026-03 (verified)** (both form and list/detail) |
| — | Admin NERIS | **Admin NERIS required fields — Done (2026-03).** Admin Functions → Reports \| NERIS: configure required fields; effective-required (NERIS + admin overrides) used in form and validation. |

---

When implementing, update this doc (e.g. mark items done or move to a "Done" section) and reference any code/PR.
