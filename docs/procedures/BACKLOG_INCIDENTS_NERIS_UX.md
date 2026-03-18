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

## Time display: military (24h) not AM/PM

- **Scope:** Times entered in any fields across the program (NERIS, Incidents, etc.) should use **military time (24-hour)**, not AM/PM.
- **Desired:** All time inputs/outputs use 24-hour format consistently.
- **Status (2026-03-18):** **Partial.** NERIS form **Core** (Incident Onset Time) and **Incident Times** module use separate date + **HH:MM:SS** (24h). Incidents UI and other screens still open.

---

## Incidents Setup – Edit Reported By layout (#5 in PRIORITY)

- **What it refers to:** **Admin Functions → Department Details → Incidents Setup.** There is an **Edit Reported By** control that lets admins configure the **Reported By** options list (e.g. "911 Caller", "Dispatch", etc.) and the mode (fill-in vs dropdown). The **layout** of that editor (the input boxes / list of options) can spill or overlap the **Assigned Units** configuration area below it.
- **Desired:** Fix CSS/layout so the Reported By editor is fully visible and does not overlap Assigned Units. No change to behavior of Create Incident or Incident Detail — only the **admin** Incidents Setup layout.

---

## NERIS Form – Initial dispatch code source (#6 in PRIORITY)

- **Where it is:** **`src/nerisMetadata.ts`** — `createDefaultNerisFormValues()`. The default for **`initial_dispatch_code`** was hardcoded as **`"AMB.UNRESP-BREATHING"`**, so every new incident/NERIS form got that value.
- **Change (2026-03):** Default is now **empty string** so new reports do not auto-populate a specific code. User selects or leaves blank per NERIS rules.
- **Desired behavior (future):** If NERIS requires a value for export → align; if CAD supplies a code → map from CAD; otherwise leave blank. Document the source of truth when CAD parsing or NERIS rules are finalized.

---

## NERIS Form – AID GIVEN / RECEIVED – Aid Department names

- **Issue:** **Aid Department name(s)** should be populated from **Mutual Aid Departments | Department Resources | Department Details | Admin Functions**. Currently the list is only grouped with "alabama" and a few departments; it should come from NERIS and list all departments **grouped by state**.
- **Example:** For a live entry where CIFPD is assisting Gilman, NERIS_ID **FD29081313** (Gilman) is not listed.
- **Desired:** Map this list to NERIS; show all departments grouped by state; ensure Gilman (FD29081313) and other mutual-aid departments appear when configured.
- **Status (2026-03-18):** **Largely done.** `GET /api/neris/entities` + Department Details **Mutual Aid** (state-grouped DD-M, NERIS + **local-only** adds). CORE **Aid department name(s)** uses configured list (NERIS + local) or full directory; UI shows **name only**; export still uses FD/FM ID for NERIS rows. Local-only choices are CORE-only (not `department_neris_id`). **Still open:** self-select exclusion below.

### Do not allow selecting the current tenant’s department (self-aid)

- **Requirement:** The Aid Department list must **not** allow the user to select the **current tenant’s** department (the incident base department NERIS ID). NERIS returns 422: "Aid department NERIS ID cannot be the same as the incident base department NERIS ID."
- **Options:** Either (1) **exclude** the tenant’s own department from the selectable list, or (2) **show it but greyed out / disabled** so it cannot be selected. Display-only (greyed out) is acceptable if needed for context.
- **Note:** The server already strips any aid entry that matches the base department before sending to NERIS (defense in depth); the UI change prevents the mistake in the first place.
- **2026-03:** The synthetic **"Current export department"** option (tenant’s own FD pre-pended to the Aid department dropdown) was **removed** so it is no longer the first selectable value. Full self-select exclusion (hide or grey out tenant’s own FD in the list) is still open.

---

## NERIS Form – "Required if" / FIRE module when auto aid given

- **Issue:** Need to verify **required-if** rules: if call type is **fire** and **auto aid** is given, the **FIRE** module may not be required.
- **Desired:** Confirm with NERIS rules and adjust client-side required validation so FIRE module is not incorrectly required in that case.
- **Status (2026-03-18):** **Implemented (client).** When **Was aid given or received?** = Yes and **Aid direction** = **Given** (mutual aid given), FIRE-module fields are **not** required (`src/nerisMetadata.ts` — `isNerisFieldRequired`). Re-validate against NERIS spec if business rules change.

---

## NERIS Form – Resources: UNIT TYPE value (#10 in PRIORITY)

- **What it refers to:** In the NERIS form **Resources** section, each resource row has a **UNIT TYPE** field. Today it may show placeholder text like "auto-populates from unit setup" instead of the **actual apparatus type** (e.g. Engine, Ladder) from **Admin Functions → Department Details → Apparatus** (or Scheduler apparatus).
- **Desired:** When a unit is assigned from department apparatus, **UNIT TYPE** should show that apparatus’s **unit type** value from Department Details, not a generic placeholder. Implementation: pull from the same apparatus source used for the queue (e.g. `apparatusFromDepartmentDetails` / Department Details payload) and map unit → unitType for the Resources grid.

---

## NERIS Form – Resources: Populate Date button and Returning

- **Issue 1 – Populate Date behavior:** When **Populate Date** is clicked, it should:
  - **Only populate dates** (not times) for: **dispatch**, **en route**, **on scene**, **clear**.
  - **Not** populate anything for **staged** or **canceled**.
- **Issue 2 – Returning:** There should be fields for **Returning** (presumably date/time for unit returning).
- **Desired:** Implement the above Populate Date logic and add Returning field(s).

---

## Delete Incident – do not delete NERIS report when In Review or Exported

- **Issue:** When an incident is deleted, the respective NERIS report (draft) is also removed. If the NERIS report is **In Review** or **Exported**, it must **not** be deleted (regulatory/audit retention).
- **Desired:** Before deleting an incident (or when performing the delete), check the NERIS report status for that incident. If status is **In Review** or **Exported**, either (1) **block** incident deletion and show a message, or (2) **soft-delete** the incident but **retain** the NERIS draft/export record. Prefer blocking deletion with a clear message so the user understands the report is protected.
- **Scope:** Incident delete flow (UI + any server logic that removes NERIS draft or export history for the incident).

---

## Summary table

| # | Area | Short description |
|---|------|-------------------|
| 1 | Incidents | Reported By in Edit — **Done 2026-03** (no overwrite; dropdown shows saved value) |
| 2 | Incidents | Dispatch notes and Callback save — **Done 2026-03** (same fix; PATCH already sent them) |
| 3 | App-wide | Times: military (24h) not AM/PM |
| 4 | Incidents Setup | Edit Reported By layout spills into Assigned Units (admin Department Details only) |
| 5 | NERIS | Initial dispatch code – default now blank; source mapping doc when CAD/NERIS finalized |
| 6 | NERIS | AID GIVEN/RECEIVED – Aid departments (mostly done; "Current export department" removed 2026-03; self-select #10 still open) |
| 7 | NERIS | Required-if: FIRE + aid given (done 2026-03-18 for direction Given) |
| 8 | NERIS | Resources UNIT TYPE – show Apparatus value from Department Details, not placeholder |
| 9 | NERIS | Resources Populate Date: dates only for dispatch/en route/on scene/clear; add Returning |
| 10 | NERIS | Aid Department: do not allow selecting tenant's own department (exclude or grey out) |
| 11 | Incidents + NERIS | **Delete Incident:** Do not delete NERIS report when status is In Review or Exported (block delete or retain report) |
| — | Admin NERIS | **Admin NERIS required fields — Done (2026-03).** Admin Functions → Reports \| NERIS: configure required fields; effective-required (NERIS + admin overrides) used in form and validation. |

---

When implementing, update this doc (e.g. mark items done or move to a "Done" section) and reference any code/PR.
