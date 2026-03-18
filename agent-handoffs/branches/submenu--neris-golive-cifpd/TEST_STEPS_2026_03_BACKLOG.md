# Test steps — backlog fixes (2026-03)

After deploying branch `submenu/neris-golive-cifpd`, use these to verify the changes.

---

## #2 Reported By in Edit

1. **Incidents → Mapping → Incidents** → **Create Incident**.
2. If **Reported By** is a **dropdown**, select a value (e.g. "911 Caller" or whatever your Department Details options are). If fill-in, type a value.
3. Fill required fields and **Create Incident**. Open the new incident (Incident Detail).
4. **Verify:** **Reported By** shows the value you selected or typed, not "Select an option" or "Manual entry".
5. Optionally edit another field, **Save**; refresh the page. **Reported By** should still show the same value.

---

## #3 Dispatch notes and Callback save

1. Open an incident from **Incidents → Mapping → Incidents** (click a row).
2. Expand **Incident Details** (toggle). Enter **Callback Number** (e.g. `555-1234`) and **Dispatch Notes** (e.g. `Test note`).
3. Click **Save Incident**. See "Incident details saved."
4. **Refresh the page** (F5 or reload).
5. **Verify:** Callback Number and Dispatch Notes still show the values you entered (not cleared).
6. In another browser (or incognito), log in same tenant, open same incident — values should match (API persistence).

---

## #4 Create Incident onset date/time → NERIS

1. **Incidents → Mapping → Incidents** → **Create Incident**.
2. Scroll to **Incident onset date** and **Incident onset time (24h, HH:MM:SS)**.
3. Set **date** (e.g. today) and **time** (e.g. `14:30:00`). Fill other required fields and create.
4. Open the new incident, then go to **Reporting → NERIS** and open the NERIS report for that incident.
5. **Verify:** **Incident Onset Date** and **Incident Onset Time** (Core section) match the date and time you entered (not current time only).
6. If you leave onset time invalid (e.g. `99:99:99`), Create should show an error: "Incident onset time must be 24-hour HH:MM:SS."

---

## #6 Initial dispatch code

1. Create a **new** incident (or open a NERIS report that has no existing draft / fresh defaults).
2. Open **Reporting → NERIS** for that incident. Go to **Core** section.
3. **Verify:** **Initial dispatch code (incident code)** is **empty** (not pre-filled with AMB.UNRESP-BREATHING). User can type or leave blank per NERIS.

---

## #8 Aid department – "Current export department" removed

1. **Reporting → NERIS** → open a report → **Core** section.
2. Find **Aid department name(s)**.
3. Open the dropdown. **Verify:** The first option is **not** "Current export department". It should be the first real department from your Mutual Aid list or NERIS directory (e.g. a state-grouped FD name).

---

## Quick smoke

- Create incident with Reported By (dropdown) → open detail → Reported By shows selected value.
- Edit incident: set Callback + Dispatch Notes → Save → refresh → values persist.
- Create incident with onset date/time → open NERIS report → Core shows same onset date/time.
- New NERIS report: Initial dispatch code blank.
- Aid department dropdown: no "Current export department" as first option.
