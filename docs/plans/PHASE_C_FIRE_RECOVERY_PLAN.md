---
name: Phase C Fire Recovery
overview: Build Stage C (Fire Recovery billing) on `cursor/stage-b-foundation-b5ff`, promote it to staging for a sandbox test, then release Stage B + C to production and submit one real Crescent vehicle-accident bill by Monday, November 2. If the sandbox test hasn't passed in time, go-live moves later.
todos:
  - id: wave-0-hygiene
    content: Pull practice branch; record decisions; save vendor docs (done 2026-11-01)
    status: completed
  - id: wave-1-sandbox-switch
    content: Render setting forces FD12345678 on staging; production refuses it (no database change)
    status: pending
  - id: wave-2-reporting-ui
    content: Driver marker, Is Resident, optional At Fault, required driver fields on vehicle accidents, remove Owner - Insurance Company (copy values), Law Enforcement Agency Report Number; print + required-fields parity
    status: pending
  - id: wave-3-mapping
    content: Full mapping (call details, narrative, responding units, actions, one driver party per vehicle); block incomplete submits
    status: pending
  - id: wave-4-preview-dedupe
    content: Preview/Confirm, Submitting lock, Needs review status, keep earlier tracking ID on failed retry, require Status 1
    status: pending
  - id: wave-5-statuses
    content: Time limits, Failed/Needs review/Sent/Paid statuses, billing status in the NERIS export view; attempt history and out-of-date flag may follow
    status: pending
  - id: wave-5b-reexport-button
    content: Bill older incidents with a button that exports to NERIS again, then opens the preview
    status: pending
  - id: wave-6-tests
    content: Fake-vendor automated tests (success, failure, timeout, double click, staging guard)
    status: pending
  - id: wave-7-sandbox-email
    content: Staging sandbox checklist (operator); send the combined Fire Recovery email now, in parallel
    status: pending
  - id: wave-8-prod
    content: "Monday: production backup, Stage B + C release per RELEASE_CHECKLIST, one controlled real bill"
    status: pending
isProject: false
---

# Phase C — Fire Recovery go-live plan (target Monday, November 2)

**This repo file is the source of truth.** Update it when a wave finishes or a decision changes, and commit it. The copy in a local `~/.cursor/plans/` folder is not shared with other agents. Steps and decisions are also recorded in the repair plan canvas (`docs/plans/canvases/repair-plan.canvas.tsx`, Stage C).

Updated: 2026-11-01, about 3:40 p.m. America/Chicago. Stage B is on staging (`submenu/neris-golive-cifpd` at `d4bbaee`). Production (`main`) does **not** have Stage B or any Fire Recovery code.

## Goal and stop rule

- **Goal:** one real Crescent vehicle-accident bill submitted from production by Monday, November 2.
- **Stop rule:** if the staging sandbox test has not passed by about noon Monday, go-live moves later. Untested billing is not released.
- **Operator availability:** Sunday evening and all day Monday.

## Branch decision (locked)

- **Code on:** `cursor/stage-b-foundation-b5ff`.
- **Test on:** promote finished code waves into `submenu/neris-golive-cifpd` (staging, `https://cifpdil.staging.fireultimate.app`).
- **Release:** Stage B + C to `main` only in Wave 8, following `docs/procedures/RELEASE_CHECKLIST.md`.

## Decisions (2026-10-29 and 2026-11-01)

| Topic | Decision |
|---|---|
| Scope | Vehicle accidents only at launch |
| Sandbox protection | Render setting: staging always sends `FD12345678`; production refuses it. No database change. |
| Party | One per vehicle: the **driver**. Passengers are not sent. |
| Required per vehicle | Driver first and last name, driver address, Is Resident, vehicle make and model, vehicle insurance company |
| Is Resident | Lives in the fire district. Must be answered and is always sent; Fire Recovery then bills only the insurance |
| At Fault | Optional yes/no for the driver |
| Vendor "Owner" flag | Yes when one of the vehicle's persons involved is the owner |
| Insurance | Vehicle insurance only. Remove "Owner - Insurance Company" and copy saved values into "Vehicle Insurance - Company Name" when that is blank |
| Narrative and units | Sent, as Fire Recovery's documentation asks |
| Law Enforcement Number | New incident-level "Law Enforcement Agency Report Number" in the Core area; falls back to the first vehicle's police report number |
| Personnel on scene | People selected on the run report for units that arrived on scene |
| Unclear vendor reply | "Needs review: check Recovery Hub"; resending blocked until an admin clears it |
| Older incidents | Button exports to NERIS again, then opens the billing preview. No override that skips the server receipt |
| Who submits | Admins plus officers (grant both "Send a NERIS report for billing" and "View billing information") |
| Billing status display | Fire Recovery screens and the NERIS report's export view |
| Vendor email | Send now from `support@fireultimatehq.com`, in parallel with building |

## Still open

1. **How is the driver marked?** Each vehicle's "persons involved" points to Person or Owner records, and Person "Affiliation" is free text. Proposal: add a "Driver" choice per vehicle (pick one of the persons involved).
2. **Operator to confirm tonight:**
   - The Fire Recovery Welcome Message (sandbox API login) arrived.
   - `FIRE_RECOVERY_CREDENTIAL_KEY` exists on the staging and production Render services.
   - Crescent's billing agreement and fee schedule are set up with Fire Recovery.

## Vendor facts (full copy: `docs/procedures/vendor/fire-recovery-usa-api-collection-2026-11-01.json`)

- The documentation marks no field as required and lists no `InvolvementType` values. Crescent's minimums are the rule.
- Success is `Done["API Response"].Status === 1` plus a `Done.TrackingId`.
- Dates look like `2026-11-01T14:30:00`, with no time zone (ask the vendor).
- Get Incident Tracking Id still needs a SubscriptionKey we don't have. "Needs review" is resolved by hand in Recovery Hub.
- New vendor endpoints (Payment Reconciliation, Totals, Invoices) are not part of this launch.

## Waves

### Wave 1 — Sandbox switch (Sunday evening)
- A server setting (for example `FIRE_RECOVERY_MODE=sandbox`) makes every submission use `FD12345678`.
- Without it, the server sends the department's NERIS Entity ID and refuses `FD12345678`.
- The preview shows which ID will be used.

### Wave 2 — Reporting tab (Sunday evening)
- Mark the driver on each vehicle.
- Add Is Resident (`DD-S` Yes/No) and an optional At Fault (`DD-S` Yes/No) for the driver.
- Remove "Owner - Insurance Company" and copy its values.
- Add the Law Enforcement Agency Report Number.
- On vehicle accidents, require: driver name, driver address, Is Resident, make, model, vehicle insurance company.
- Print summary and Admin NERIS Required Fields parity (`cursoragent-context.md` 42b/42c).

### Wave 3 — Mapping (Sunday evening)
- `server/fireRecoveryMapping.mjs`:
  - Call details: alarm, first on scene, cleared, canceled en route, incident number, location, NFIRS/NERIS type and description, station.
  - Narrative, responding units with their actions, and incident actions.
  - Personnel on scene.
  - Law enforcement number.
  - One driver party per vehicle.
- Clear block message listing missing fields.

### Wave 4 — Preview and no double bill (Sunday evening)
- Preview, then Confirm, with a Submitting lock that ignores repeats.
- "Needs review" for unclear replies.
- A failed retry never clears an earlier tracking ID or success.
- Require Status 1.

### Wave 5 — Statuses (Sunday evening / Monday morning)
- Time limits on vendor calls.
- Statuses Not sent / Submitting / Sent / Failed / Needs review / Paid-Balance due.
- Billing status in the NERIS export view.
- Attempt history and "billing may be out of date" can follow after launch.

### Wave 5b — Older incidents (Monday morning)
- Button: export to NERIS again, then open the billing preview.
- Security fix 5b says to check first on staging whether a second NERIS export updates or duplicates. If it duplicates, stop and ask.

### Wave 6 — Fake-vendor tests (Sunday evening)
- Success, failure, timeout, unclear reply, double click, staging guard, missing required fields.

### Wave 7 — Staging sandbox test (operator, Sunday night or Monday morning)
- Operator sets the sandbox switch and `FIRE_RECOVERY_CREDENTIAL_KEY` on staging Render and enters the sandbox login.
- Bill one two-vehicle accident, check billing status, and try a double click.
- Send the vendor email now; add the test results as a follow-up.

### Wave 8 — Production (Monday, during the day)
- Backup.
- Stage B + C release per `docs/procedures/RELEASE_CHECKLIST.md` (3 new migrations, `NODE_ENV`, Crescent sender).
- Production `FIRE_RECOVERY_CREDENTIAL_KEY`.
- Crescent's real Fire Recovery login.
- Officer permissions.
- One real vehicle-accident bill.
- CAD automation stays off.

## Key files

- `server/fireRecoveryMapping.mjs`, `server/fireRecoveryClient.mjs`, `server/neris-proxy.mjs` (submit at about line 4023), `server/auth/permissions.mjs`
- `src/pages/NerisReportFormPage.tsx` (Person/Owner/Vehicle types about line 630), `src/nerisMetadata.ts` (about line 2300)
- `src/pages/FireRecoveryIncidentsPage.tsx`, `src/pages/FireRecoveryIncidentDetailPage.tsx`, `src/api/fireRecovery.ts`
- `docs/procedures/FIRE_RECOVERY_USA_API_REFERENCE.md`, `docs/plans/canvases/repair-plan.canvas.tsx`

## Out of scope

- Inspection and invoice billing, attachments, bulk status, payment reports, CAD Stage D, and the parked items.
