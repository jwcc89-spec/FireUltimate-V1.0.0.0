# Backlog: Incidents & NERIS Form UX (To Change Later)

Captured 2026-03-13 from production testing on cifpdil.fireultimate.app. These are **not** blocking go-live; prioritize and schedule as follow-up work.

---

## Incidents (Create / Edit)

### 1. Reported By – shows "manual entry" in Edit
- **Issue:** When an incident is created and a value is manually typed into **Reported By**, opening **Edit Incident** shows **"manual entry"** instead of the typed value.
- **Desired:** Edit view should show the actual value that was entered.

### 2. Dispatch notes and Callback Number do not save
- **Issue:** **Dispatch notes** and **Callback Number** do not persist. When **Edit Incident** is opened, these fields are not visible / not saved.
- **Desired:** Both fields should save with the incident and display when editing.

---

## Time display: military (24h) not AM/PM

- **Scope:** Times entered in any fields across the program (NERIS, Incidents, etc.) should use **military time (24-hour)**, not AM/PM.
- **Desired:** All time inputs/outputs use 24-hour format consistently.

---

## Incidents Setup – Edit Reported By layout

- **Issue:** When **Edit Reported By** is clicked, the boxes are not viewable properly; they appear to spill into **Assigned Units**.
- **Desired:** Layout should keep Reported By controls visible and not overlap Assigned Units.

---

## NERIS Form – Initial dispatch code source

- **Issue:** Need to define where **Initial dispatch code** is populated from.
- **Desired behavior (to confirm):**
  - If NERIS has a mandatory value for export → align with NERIS.
  - Else if available from CAD → align with CAD.
  - If neither → leave blank.
- **Action:** Document/implement the mapping and source of truth.

---

## NERIS Form – AID GIVEN / RECEIVED – Aid Department names

- **Issue:** **Aid Department name(s)** should be populated from **Mutual Aid Departments | Department Resources | Department Details | Admin Functions**. Currently the list is only grouped with "alabama" and a few departments; it should come from NERIS and list all departments **grouped by state**.
- **Example:** For a live entry where CIFPD is assisting Gilman, NERIS_ID **FD29081313** (Gilman) is not listed.
- **Desired:** Map this list to NERIS; show all departments grouped by state; ensure Gilman (FD29081313) and other mutual-aid departments appear when configured.

### Do not allow selecting the current tenant’s department (self-aid)

- **Requirement:** The Aid Department list must **not** allow the user to select the **current tenant’s** department (the incident base department NERIS ID). NERIS returns 422: "Aid department NERIS ID cannot be the same as the incident base department NERIS ID."
- **Options:** Either (1) **exclude** the tenant’s own department from the selectable list, or (2) **show it but greyed out / disabled** so it cannot be selected. Display-only (greyed out) is acceptable if needed for context.
- **Note:** The server already strips any aid entry that matches the base department before sending to NERIS (defense in depth); the UI change prevents the mistake in the first place.

---

## NERIS Form – "Required if" / FIRE module when auto aid given

- **Issue:** Need to verify **required-if** rules: if call type is **fire** and **auto aid** is given, the **FIRE** module may not be required.
- **Desired:** Confirm with NERIS rules and adjust client-side required validation so FIRE module is not incorrectly required in that case.

---

## NERIS Form – Resources: UNIT TYPE value

- **Issue:** **UNIT TYPE** shows the placeholder text "auto-populates from unit setup" instead of the **actual value** from **Apparatus** in Department Details.
- **Desired:** Show the real value pulled from Apparatus in the Department Details submenu.

---

## NERIS Form – Resources: Populate Date button and Returning

- **Issue 1 – Populate Date behavior:** When **Populate Date** is clicked, it should:
  - **Only populate dates** (not times) for: **dispatch**, **en route**, **on scene**, **clear**.
  - **Not** populate anything for **staged** or **canceled**.
- **Issue 2 – Returning:** There should be fields for **Returning** (presumably date/time for unit returning).
- **Desired:** Implement the above Populate Date logic and add Returning field(s).

---

## Summary table

| # | Area | Short description |
|---|------|-------------------|
| 1 | Incidents | Reported By shows "manual entry" in Edit instead of typed value |
| 2 | Incidents | Dispatch notes and Callback Number don't save in Edit |
| 3 | App-wide | Times: military (24h) not AM/PM |
| 4 | Incidents Setup | Edit Reported By layout spills into Assigned Units |
| 5 | NERIS | Initial dispatch code – define source (NERIS / CAD / blank) |
| 6 | NERIS | AID GIVEN/RECEIVED – Aid departments from NERIS, grouped by state (e.g. FD29081313) |
| 7 | NERIS | Required-if: FIRE module when fire + auto aid |
| 8 | NERIS | Resources UNIT TYPE – show Apparatus value, not placeholder |
| 9 | NERIS | Resources Populate Date: dates only for dispatch/en route/on scene/clear; add Returning |
| 10 | NERIS | Aid Department: do not allow selecting tenant’s own department (exclude from list or show greyed out) |

---

When implementing, update this doc (e.g. mark items done or move to a "Done" section) and reference any code/PR.
