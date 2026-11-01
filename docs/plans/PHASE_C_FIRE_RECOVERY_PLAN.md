# Phase C — Fire Recovery billing go-live plan

**Status:** Planning complete except the approvals in §14. No Stage C code is written yet.
**Updated:** 2026-11-01, about 4:30 p.m. America/Chicago.
**Target:** one real Crescent motor-vehicle-incident bill submitted from production on **Monday, November 2, 2026**.
**Branch:** `cursor/stage-b-foundation-b5ff` (practice). Staging branch: `submenu/neris-golive-cifpd`. Production: `main`.

> **When this plan is complete:** move this file to `docs/plans/completed/PHASE_C_FIRE_RECOVERY_PLAN.md` (create the folder if it does not exist) using `git mv`. Then update every link to it (`agent-handoffs/branches/cursor--stage-b-foundation-b5ff/ACTIVE_CONTEXT.md`, `docs/task-2-multitenant-domain-plan.md`, the latest session note) and commit. "Complete" means §12's done list is fully checked and one real production bill has a tracking ID.

---

## 0. How to use this plan (read first, every agent)

1. **This repo file is the source of truth.** A copy in a local `~/.cursor/plans/` folder is not shared with other agents; ignore it.
2. Before editing anything, read:
   - `cursoragent-context.md`
   - `.cursor/project-context.md`
   - `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/ACTIVE_CONTEXT.md`
   - `docs/plans/security-remediation-plan.md` (Status line)
   - this plan
   - `docs/procedures/FIRE_RECOVERY_USA_API_REFERENCE.md`
3. Work one wave at a time (§9). After each wave:
   - Run `npm run lint`, `npm run build`, and `npm test` from `/Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`.
   - Tick the wave's boxes here.
   - Add a line to §15 (Progress log).
   - Commit and push.
4. When a decision changes, update §3 in this file, then record it in the repair-plan canvas copy (`docs/plans/canvases/repair-plan.canvas.tsx`, Stage C steps 10–18 and the Decisions table) and in `docs/task-2-multitenant-domain-plan.md`.
5. **Never:**
   - Submit to Fire Recovery from staging with any department ID other than `FD12345678`.
   - Put Fire Recovery usernames or passwords in chat, docs, code, tests, or `DepartmentDetails.payloadJson`.
   - Log billing payloads; they contain names, addresses and insurance details.
   - Commit screenshots that show real people.
   - Change the Prisma schema, migrations, or authentication/authorization code without the operator's explicit approval (§14).
6. The operator (Jeremy) is new to coding. Give him numbered steps with the exact screen, the exact button, the exact text to type, and what he should see. Terminal steps always start with `cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`.
7. All times are 24-hour, app-wide.

---

## 1. Goal, timeline, stop rule

| When | What | Who |
|---|---|---|
| Sunday evening | Waves 1–6 built on the practice branch, tested, promoted to staging | Agent |
| Sunday night / Monday morning | Wave 7 staging sandbox test (§11.2) | Operator, with agent |
| Monday, any time | Send the Fire Recovery email (§13) | Operator |
| Monday, during the day | Wave 8 production release + one real bill (§11.3) | Both |

**Stop rule:** if the staging sandbox test has not fully passed by about **12:00 Monday**, go-live moves to a later day. Untested billing is never released. Production can still receive Stage B on Monday, but only with Fire Recovery switched off (`FIRE_RECOVERY_MODE` unset).

**Operator availability:** Sunday evening and all day Monday.

**Already confirmed (2026-11-01):**
- Crescent's billing agreement and fee schedule with Fire Recovery are signed and set up.
- Fire Recovery's Welcome email (in `support@fireultimatehq.com`) contains an "RH public API" username and password. "RH" means Recovery Hub. The API address is `https://process.firerecoveryusa.com`; the app already uses it by default (`server/fireRecoveryClient.mjs`). Whether this login is for the sandbox only or also for real bills is unknown (in the vendor email).
- `FIRE_RECOVERY_CREDENTIAL_KEY` does **not** exist on `fireultimate-api-staging` or on `fireultimate-api-prod`.

---

## 2. What exists today (verified in code, 2026-11-01)

| Piece | Where | State |
|---|---|---|
| Vendor HTTP client (login, Add NERIS Incident, billing status) | `server/fireRecoveryClient.mjs` | Works. No time limits. Accepts any reply that has a TrackingId (does not check `Status === 1`). |
| Payload mapping | `server/fireRecoveryMapping.mjs` | Sends only `CostRecovery` with `Parties: []`. Reads `body.formValues` from the export receipt, which has none (see §2.1). `PrincipleIncidentType` keeps only the part before the first colon (e.g. `MEDICAL`). |
| Routes | `server/neris-proxy.mjs` about lines 3772–4290 | `GET/PATCH /api/fire-recovery/settings`, `GET /api/fire-recovery/incidents`, `GET /api/fire-recovery/incidents/:callNumber`, `POST /api/fire-recovery/submit`, `POST /api/fire-recovery/billing-status` |
| Permissions | `server/auth/permissions.mjs` lines 13–15, 106–114 | `billing.view` (list/detail), `billing.submit` (submit + billing status), `billing.settings` (settings). All admin by default; grantable in Admin Functions. |
| Password encryption | `server/crypto/secretBox.mjs` | `enc:v1:` AES-256-GCM using Render setting `FIRE_RECOVERY_CREDENTIAL_KEY`. If the key is missing, saving a password fails. |
| Billing row | Prisma `FireRecoveryIncidentBilling` (`prisma/schema.prisma` lines 40–68) | One row per tenant + call number: `trackingId`, `lastSubmitAt`, `lastSubmitOk`, `lastSubmitError`, invoice fields, `billingFetchedAt`. **No status column.** |
| Send button | `src/App.tsx` about line 6036–6066, NERIS **Export Details** page (`/reporting/neris/exports/:callNumber`) | "Send to Fire Recovery" posts immediately: no preview, no confirm, no lock. |
| Lists | `src/pages/FireRecoveryIncidentsPage.tsx`, `src/pages/FireRecoveryIncidentDetailPage.tsx`, `src/api/fireRecovery.ts`; queue column `src/App.tsx` about line 5877 | Shows `-` or `DataSent`. Detail has an Update (billing status) button. |
| Settings screen | `SetupFireRecoveryPanel`, `src/App.tsx` about line 12227 (Admin Functions → Setup/Configuration → Fire Recovery) | Department name, API username, password. |
| Person/Owner/Vehicle section of the NERIS report | `src/pages/NerisReportFormPage.tsx` (types about line 630; JSON in `person_owner_persons_json`, `person_owner_owners_json`, `person_owner_vehicles_json`) | General contacts section. **Stays as-is** (decision D-6). |
| Required-field admin | `NerisRequiredFieldsAdminPage`, `src/App.tsx` about line 6398; stored as `nerisRequiredFieldOverrides` (list of field IDs) in department details | Can only *add* required fields. |
| Tests | `server/auth/sessions.test.mjs` (permissions, encryption, tenant isolation for billing) | No vendor success/failure/timeout tests. |

### 2.1 Bugs that must be fixed during this plan

1. **Billing receives none of the report's answers.** `writeNerisExportReceipt` (`server/neris-proxy.mjs` about line 2973) stores `JSON.stringify(payload)`, and `payload` is the NERIS API payload (`base`, `incident_types`, `dispatch`, …). It does not contain the report's `formValues`. `buildNerisIncidentForBillingPayload` reads `body.formValues`, so every report-based value is blank. Fix in Wave 3 (§7.1).
2. **A failed retry hides a real bill.** The submit `catch` block sets `lastSubmitOk: false` on a row that may already have a good `trackingId`. Fix in Wave 4.
3. **Any error after Fire Recovery accepted the bill is stored as "failed."** Staff would retry and bill twice. Fix in Wave 4 ("Needs review").
4. **No time limits** on vendor calls. Fix in Wave 4.
5. **Success check too weak.** The client must require `Done["API Response"].Status === 1` **and** `Done.TrackingId`. Fix in Wave 4.
6. **Person/Owner vehicle links use list positions** (`person:0`, `owner:1`). Deleting a person (`NerisReportFormPage.tsx` about line 7637) does not update vehicles, so links shift. This matters for "Copy from report" (Wave 2). Copy must resolve names at copy time, and never store these position refs in billing data.

---

## 3. Decisions (final as of 2026-11-01; supersede earlier chat notes)

| ID | Topic | Decision |
|---|---|---|
| D-1 | Go-live | One real Crescent bill from production on Monday Nov 2; stop rule in §1 |
| D-2 | Billable incidents | Only when the primary **or any additional** NERIS incident type is one of: `MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION`, `HAZSIT: HAZARD_NONCHEM: MOTOR_VEHICLE_COLLISION`, `RESCUE: TRANSPORTATION: MOTOR_VEHICLE_EXTRICATION_ENTRAPPED` (labels as in `src/nerisMetadata.ts` lines 217, 261, 300; match on the stored value, whatever separator it uses) |
| D-3 | Sandbox safety | Render setting `FIRE_RECOVERY_MODE`: `sandbox` = always send `FD12345678`; `live` = send the department's NERIS Entity ID and refuse `FD12345678`; unset/anything else = refuse every submit. No database change |
| D-4 | Where billing data is entered | A new **Fire Recovery Billing** tab inside the NERIS report, laid out like Recovery Hub's "Create New Motor Vehicle Incident" form (§5). Saved with the report. No database change for the form itself |
| D-5 | Changes after export | Only an admin adds missing billing info later: admin unlocks the Exported report, edits the Fire Recovery Billing tab, and exports to NERIS again. Billing is blocked while the report is not Exported |
| D-6 | Person/Owner tab | Left exactly as it is. The earlier ideas (Is Owner / Is Driver checkboxes, removing Add Owner, removing "Owner - Insurance Company") are **cancelled** |
| D-7 | Party | A party is one billing card: name and address, insurance, vehicle. No driver/owner concept, matching Recovery Hub. A parked car's owner is entered as that vehicle's party |
| D-8 | Copy from report | A "Copy from Person/Owner" button pre-fills party cards from the Person/Owner/Vehicle section; staff edit after copying |
| D-9 | Required fields | Defaults in §6. **Is Resident is required for Crescent** (local ordinance: residents are not billed directly), even though Recovery Hub marks it recommended. An admin can change any billing field between Required / Recommended / Optional in Admin Functions |
| D-10 | Incomplete billing info | Fire Recovery submit is blocked, with a list of what is missing. NERIS export is **never** blocked by billing fields |
| D-11 | Uninsured | A per-party "Uninsured" checkbox waives the insurance company requirement. The party is still sent; Fire Recovery decides |
| D-12 | Run type | Motor Vehicle Incident or Commercial Trucking Incident. Each party also has a Commercial vehicle checkbox and DOT number |
| D-13 | Is Resident meaning | The person lives in the fire district. Always sent; Fire Recovery then bills only insurance |
| D-14 | At Fault | Optional Yes/No per party |
| D-15 | NERIS code | Recovery Hub now asks for a **NERIS Code** (not NFIRS). Pre-fill from the report's primary incident type, editable on the tab; send the full value |
| D-16 | Narrative and units | Sent (Fire Recovery's docs ask for them) |
| D-17 | Unclear vendor reply | Status "Needs review: check Recovery Hub"; resending is blocked until an admin resolves it (§7.4) |
| D-18 | Double billing | One submission per incident. Once a tracking ID exists, the app never sends that incident again; corrections happen in Recovery Hub |
| D-19 | Older incidents | Exports written before the server receipt existed do not count. Export Details offers "Export to NERIS again, then bill". There is no override that skips the receipt |
| D-20 | Who submits | Admins, plus officers when Crescent's admin grants both "Send a NERIS report for billing" and "View billing information" |
| D-21 | Billing status refresh | Manual only (Update button) at launch |
| D-22 | Where status shows | Export Details page, Fire Recovery list/detail, and the queue's Fire Recovery column |
| D-23 | Vendor email | Send now (§13), test results follow later |
| D-24 | Billing reads the report from the locked draft | See §7.1 |

---

## 4. Vendor facts (full copy: `docs/procedures/vendor/fire-recovery-usa-api-collection-2026-11-01.json`)

- **Endpoint:** `POST https://process.firerecoveryusa.com/Primary/restapi/rhpublicapi/flows/v2apis/incidents/rms/addincident`, Bearer JWT from `POST /Primary/REST/AccountService/LoginAndGetJWTToken`. Get a fresh token before each call.
- **Success:** `{"Done":{"API Response":{"ErrorCode":null,"Status":1,"Message":"Success"},"TrackingId":"<uuid>"}}`.
- **Required fields:** the vendor marks none in the API docs and lists no `InvolvementType` values. Recovery Hub's screen marks red = required and orange = recommended (§5). We follow §6.
- **Dates:** `YYYY-MM-DDTHH:MM:SS` with no time zone. Send department local time (confirm in the email).
- **Lost tracking ID:** Get Incident Tracking Id still needs a SubscriptionKey we don't have, so "Needs review" is resolved by hand in Recovery Hub (`https://therecoveryhub.com/users/login`).
- **Billing status example:** strings, e.g. `"InvoiceAmount": "2564.00"`, `"InvoiceStatus": "Payment Received"`.
- **Not used now:** attachments, bulk status, payment reconciliation, totals, invoices, inspections.

---

## 5. Fire Recovery Billing tab — UI spec (mimic Recovery Hub)

**Reference image (blank form, no personal data):** `docs/plans/assets/phase-c-fire-recovery/recovery-hub-create-motor-vehicle-incident-blank.png`. Commit only blank or sandbox screenshots to that folder.

### 5.1 Where it appears

- A new section/tab in the NERIS report (`src/pages/NerisReportFormPage.tsx`) titled **Fire Recovery Billing**, placed after Person/Owner.
- **Shown only** when D-2 matches (primary or any additional type). When hidden, saved billing data is kept but not sent.
- **Read-only** whenever the report is In Review or Exported, like every other section. An admin unlocks to edit (D-5).

### 5.2 Layout (top to bottom, same order and labels as Recovery Hub)

**Header:** "Fire Recovery Billing — Create Motor Vehicle Incident for {Department name}". Next to it:
- a completeness chip (`STAT-CHIP`): "Ready to bill" (green) or "N required fields missing" (red).
- a legend: red bar = Required, orange bar = Recommended.

Use a 3px left/right bar on the input the way Recovery Hub does: red for Required, orange for Recommended. Colors come from existing CSS variables or the error and warning colors already used in the app.

**Run Type** (`QC` chips, single choice):
- Motor Vehicle Incident (default)
- Commercial Trucking Incident

(Recovery Hub also offers Structure Fire and Other; those are out of scope.)

**Form Filed By:** read-only (`RO-BOX`). Shows "Filled in from the signed-in person when sent." The server fills it at submit time from the submitting user's account display name, or the username if there is no display name.

**Incident Details** (3-column grid like Recovery Hub). All are `RO-BOX` (read-only, copied from the report) except where noted:

| Recovery Hub label | Source in the report | Notes |
|---|---|---|
| Run Date | `incident_onset_date` | Show as `MM/DD/YYYY` to match Recovery Hub |
| Time Alarm Received | `incident_time_call_arrival` (call arrival at dispatch; §14 Q3) | 24-hour `HH:MM` |
| Time Call Cleared | `incident_time_clear` | 24-hour |
| Run Number | `incident_internal_id` (Crescent incident number, e.g. `26-079`) | Confirmed (§14 Q4) |
| Law Enforcement Agency Report Number | **Editable** text, new | Optional. If blank, the server falls back to the first Person/Owner vehicle's `policeReportFileNumber` |
| Total Personnel On-Scene | Count of distinct people assigned to units that arrived on scene (`resource_units_json`) | Show the count, and the names on hover |
| NERIS Code | **Editable** `DD-S` with the NERIS incident type list, pre-filled from `primary_incident_type` | D-15 |
| Incident Location | street, city, state, zip from the report's location fields (`incident_location_address`, `location_state`, `location_postal_code`; city field to be confirmed in code) | Four boxes in one row, like Recovery Hub |

**Buttons:**
- "Copy from Person/Owner" (D-8). Creates one party per Person/Owner **vehicle** that has persons involved.
  - Name and address come from the first listed person.
  - Make, model, plate, VIN and year come from the vehicle.
  - Insurance company, policy number and insurance contact (`insuranceCompanyPhone`) come from the vehicle.
  - Uninsured comes from the vehicle.
  - If the tab already has parties, ask "Replace the current parties?" with Replace / Cancel.
- "Add Party" adds an empty party card.

Recovery Hub's "How many parties are involved?" dropdown is replaced by Add Party / Delete This Party, which do the same job.

**Party Details:** one grey card per party titled "PARTY 1", "PARTY 2", …, with three columns and a red "Delete This Party" button at the bottom (asks for confirmation):

| Column | Field | Input | Default requirement |
|---|---|---|---|
| Name and Address | First Name | text | Required |
| | Last Name | text | Required |
| | Party Address: Street, City, State, Zip | 4 text boxes (vendor wants separate fields) | Required (all four) |
| | Party Phone | text | Recommended |
| | Party Email | text | Optional |
| | Is Resident? | `DD-S` Yes / No | **Required** (D-9) |
| Insurance | Uninsured | checkbox | — (when checked, insurance fields are not required) |
| | Insurance Company / Liable Party | text | Required unless Uninsured |
| | Policy Number | text | Recommended |
| | Insurance Contact Number | text | Recommended |
| Vehicle | Vehicle Make | text | Required |
| | Vehicle Model | text | Required |
| | Vehicle Year | text | Optional |
| | License Plate | text | Recommended |
| | VIN | text | Recommended |
| | Other Vehicle Details | text | Optional |
| | At Fault Party | `DD-S` Yes / No / blank | Optional |
| | Commercial vehicle | checkbox | Optional; shown for every run type |
| | DOT Number | text, shown when Commercial vehicle is checked | Optional |
| | Company Name | text, shown when Commercial vehicle is checked | Optional |

Recovery Hub uses one "Vehicle Make & Model" box. We keep two boxes side by side under that heading, because the API has separate `VehicleMake` and `VehicleModel`.

**Not copied from Recovery Hub (later):**
- Attachments drop zone
- POP Score (probability of payment)
- Validate address
- Search Incidents

### 5.3 Print and admin parity (required by `cursoragent-context.md` 42b/42c)

- Print summary: add a "Fire Recovery Billing" block that lists run type, law enforcement number, NERIS code, and each party's filled fields.
- Admin Functions → Reporting → NERIS Required Fields: add a **"Fire Recovery Billing"** group (§6).

---

## 6. Requirement levels (D-9, D-10)

**Default levels.** Admins can change these per department. "Party.*" means every party.

| Key | Label | Default |
|---|---|---|
| `fr.lawEnforcementNumber` | Law Enforcement Agency Report Number | Optional |
| `fr.nerisCode` | NERIS Code | Required |
| `fr.party.firstName` | First Name | Required |
| `fr.party.lastName` | Last Name | Required |
| `fr.party.address` | Party Address (street, city, state, zip) | Required |
| `fr.party.phone` | Party Phone | Recommended |
| `fr.party.email` | Party Email | Optional |
| `fr.party.isResident` | Is Resident? | Required |
| `fr.party.insuranceCompany` | Insurance Company / Liable Party | Required (waived by Uninsured) |
| `fr.party.policyNumber` | Policy Number | Recommended |
| `fr.party.insuranceContact` | Insurance Contact Number | Recommended |
| `fr.party.vehicleMake` | Vehicle Make | Required |
| `fr.party.vehicleModel` | Vehicle Model | Required |
| `fr.party.licensePlate` | License Plate | Recommended |
| `fr.party.vin` | VIN | Recommended |
| `fr.party.atFault` | At Fault Party | Optional |

**Always required, not adjustable:**
- At least one party.
- The call details Run Date, Time Alarm Received, Time Call Cleared, Run Number, Total Personnel On-Scene (more than 0), and Incident Location. If any is blank, the tab shows "Fix this in the report's {section} section", with a link.

**Storage:**
- Department details JSON key `fireRecoveryFieldRequirements`, shaped like `{ "fr.party.isResident": "required", ... }`.
- Missing keys use the defaults above.
- This is a non-secret setting, so it is allowed in `DepartmentDetails.payloadJson`.
- Edited in the new "Fire Recovery Billing" group of the NERIS Required Fields admin page, with a Required / Recommended / Optional `DD-S` per row.
- Saving needs `settings.department` (the existing rule for department details).

**Enforcement:**
- **Browser:** markers and the completeness chip.
- **Server:** the preview and submit routes recompute missing Required fields from the same defaults plus the department's settings, and refuse with the list.
- Put the defaults and the "find missing fields" logic in **one shared module**, `src/fireRecovery/billingRequirements.ts` (or `.mjs`). Both the browser and the server import it, so they can't disagree.
- Recommended fields never block; the preview lists them as "Recommended, missing".

---

## 7. Server design

### 7.1 Data source for billing (fixes bug 2.1.1; D-24)

At preview/submit time the server:
1. Finds the latest export receipt for the call number (`NerisExportHistory` with `attemptStatus: "success"` and `responseDetail` starting with `SERVER_EXPORT_RECEIPT`), as today. No receipt means: "Export this report to NERIS first."
2. Loads the **server-saved report** (`NerisDraft` for tenant + call number) and requires `payload.reportStatus === "Exported"`. Otherwise: "This report was unlocked after export. Export it to NERIS again before billing."
   - The server already refuses edits to Exported reports, so the draft's `formValues` equal what was exported.
   - Confirm in code where `formValues` sit inside `NerisDraft.payload`.
3. Builds the Fire Recovery payload from the draft's `formValues` plus `fire_recovery_billing_json`, and takes `NerisIdIncident` from the receipt's `nerisId`.

Do not change the receipt format (security fix 5 area).

### 7.2 Billing data in the report

- Stored as one form value, `fire_recovery_billing_json`: a JSON string, the same pattern as `person_owner_vehicles_json`.
- Add the matching metadata entry in `src/nerisMetadata.ts` (sectionId `fireRecoveryBilling`) so print summary, change history labels and the required-fields admin can find it.
- **Shape (TypeScript):**

```ts
type FireRecoveryBilling = {
  version: 1;
  runType: "MOTOR_VEHICLE" | "COMMERCIAL_TRUCKING";
  lawEnforcementReportNumber: string;
  nerisCode: string;            // full NERIS incident type value; "" = use primary_incident_type
  parties: Array<{
    id: string;                 // random id (crypto.randomUUID); never a list position
    firstName: string; lastName: string;
    street: string; city: string; state: string; zip: string;
    phone: string; email: string;
    isResident: "" | "YES" | "NO";
    uninsured: boolean;
    insuranceCompany: string; policyNumber: string; insuranceContactNumber: string;
    vehicleMake: string; vehicleModel: string; vehicleYear: string;
    licensePlate: string; vin: string; otherVehicleDetails: string;
    atFault: "" | "YES" | "NO";
    commercialVehicle: boolean; dotNumber: string; companyName: string;
  }>;
};
```

- **NERIS export must ignore this field.** Check that `buildIncidentPayload` (`server/neris-proxy.mjs` about line 1077) does not copy unknown form values into the NERIS payload.
- **Change history:** add the label "Fire Recovery Billing" for `fire_recovery_billing_json`.

### 7.3 Mapping (`server/fireRecoveryMapping.mjs`, rewrite)

| Vendor field | Value |
|---|---|
| `NERISDepartmentId` | D-3: `FD12345678` in sandbox mode, otherwise `Tenant.nerisEntityId` |
| `DepartmentName` | `Tenant.fireRecoveryDepartmentName` |
| `incident.IncidentID` | the report's call number (app incident id) |
| `incident.IncidentType` | NERIS code (D-15), full value |
| `incident.IncidentTypeDescription` | readable label of that NERIS code |
| `incident.AlarmDateTime` | Run Date + Time Alarm Received, `YYYY-MM-DDTHH:MM:SS` local |
| `incident.FirstUnitOnSceneDateTime` | `incident_time_unit_on_scene` (or earliest unit on-scene time) |
| `incident.ClearedDateTime` | `incident_time_clear` |
| `incident.CanceledInRoute` | true only if every unit was canceled en route |
| `incident.Location` | street, city, state, zip; `LocationID` = call number |
| `incident.Stations.Station` | first unit's station, if known; else omit |
| `incident.Narrative` | the report narrative fields joined (`narrative`, `narrative_outcome`, `narrative_obstacles`), trimmed |
| `incident.IncidentActionsTaken[]` | from `incident_actions_taken` (code + label) |
| `incident.RespondingUnits[]` | from `resource_units_json`: `UnitNumber`, `UnitTypeCode`/`UnitTypeDescription`, on-scene/clear times, `UnitCanceledEnRoute` |
| `incident.Occupancydata` | omit for vehicle incidents |
| `CostRecovery.PrincipleIncidentType` | same NERIS code as `IncidentType`. Fix today's cut-at-the-first-colon bug |
| `CostRecovery.NerisIdIncident` | receipt `nerisId` |
| `CostRecovery.IncidentNumber` | Run Number (`incident_internal_id`) |
| `CostRecovery.LawEnforcementNumber` | tab value, else first vehicle `policeReportFileNumber`, else "" |
| `CostRecovery.CatchCreated` | submit time, `YYYY-MM-DDTHH:MM:SS` local |
| `CostRecovery.TotalPersonnelOnScene` | §5.2 count |
| `CostRecovery.FiledBy` | submitting user's first/middle/last (from account), else the username split |
| `CostRecovery.Parties[].Party` | per party: `First`, `Last`, `Address`, `City`, `State`, `Zip`, `Phone`, `Email`, `Isresident` (YES → true), `AtFault` (YES → true), and `Vehicle` with `VehicleMake`, `VehicleModel`, `VehicleYear`, `LicensePlate`, `VehicleVIN`, `VehicleOther`, `InsuranceCompanyName` ("" when uninsured), `PolicyNumber`, `InsuranceContactNumber`, `CommercialVehicle`, `DOTNumber`, `CompanyName`, and `Owner: false`. Omit `SSNumber`, `PartySSN` and `DOB` (we don't collect them). Leave `InvolvementType` and `InvolTypeDescript` "" until the vendor answers |

- **Time zone:** use the department's offset; the export receipt has `clientUtcOffsetMinutes` in `integration`. If unknown, use America/Chicago.
- **Commercial trucking (D-12):** sent as `CommercialVehicle` per party. Ask the vendor how a Commercial Trucking run type is flagged.
- **Tests:** keep the mapping a pure function, `buildFireRecoveryPayload(formValues, receipt, tenant, submitter, mode)`, with unit tests.

### 7.4 Submit flow and statuses

**New/changed routes.** Changes to `permissions.mjs` need approval (§14 Q2).

| Route | Permission | Purpose |
|---|---|---|
| `POST /api/fire-recovery/preview` | `billing.submit` | Returns the readable preview, the exact payload, the department ID and mode, the missing Required and Recommended lists, and a `previewHash` (SHA-256 of the payload JSON). Never calls the vendor. |
| `POST /api/fire-recovery/submit` | `billing.submit` | Body `{ callNumber, previewHash }`. The server rebuilds the payload; if the hash differs: "The report changed since the preview. Preview again." |
| `POST /api/fire-recovery/resolve-review` | admin only (role level ≥ admin) | Body `{ callNumber, outcome: "not_received" \| "received", trackingId? }`, used after the admin checks Recovery Hub |
| `POST /api/fire-recovery/billing-status` | `billing.submit` (unchanged) | Add time limit |

**Statuses** shown to staff:

| Status | Meaning |
|---|---|
| Not sent | No submission yet |
| Submitting | Lock held; vendor call in progress |
| Sent | `Status 1` + tracking ID saved |
| Failed | Fire Recovery clearly refused (HTTP 400–499 with an error message, or login refused). Nothing was billed. Safe to fix and resend |
| Needs review | Outcome unknown (time limit, network error, HTTP 500+, unreadable reply, 200 without `Status 1` + tracking ID). Resend blocked |
| Invoice status | After Update: vendor `InvoiceStatus` (e.g. "Payment Received") with amount due and paid |

**Submit steps (server):**
1. Check `FIRE_RECOVERY_MODE`, tenant login, D-2 type, §7.1 source, §6 required fields, and the `previewHash`.
2. **Take the lock atomically.** One conditional `updateMany`/`upsert` sets status Submitting only when the current status is Not sent or Failed and `trackingId` is empty. If 0 rows change, return 409 "Already sent, being sent, or needs review."
3. Get a JWT (time limit 20 s), then POST the bill (time limit 45 s), using `AbortController`.
4. Save the result as Sent / Failed / Needs review. **Never clear an existing `trackingId`.**
5. Never log the payload or the vendor reply body. Log only the call number, status and HTTP code.

**Stale lock:** if Submitting is older than 5 minutes, show it as Needs review.

**Status storage needs approval (§14 Q1):**
- **Option A (recommended):** add-only migration on `FireRecoveryIncidentBilling` with `submitStatus String @default("")` and `submitStartedAt DateTime?`. Optional second table `FireRecoveryAttempt` for attempt history (who, when, status, HTTP code, short message; no payload).
- **Option B (no migration):** status kept in `lastSubmitError` with a prefix (`SUBMITTING:`, `NEEDS_REVIEW:`) and the lock done by a conditional update on that column. It works, but it's fragile and harder to read.

### 7.5 Sandbox switch (D-3)

- Read `process.env.FIRE_RECOVERY_MODE` on every preview and submit.
- Sandbox mode:
  - Department ID is always `FD12345678`.
  - The preview and the Export Details panel show a yellow banner: "SANDBOX — Fire Recovery will not bill this."
- Live mode:
  - Department ID is `Tenant.nerisEntityId`, which must match `FD########`.
  - Refuse if it equals `FD12345678`.
  - The preview shows a red banner: "LIVE — this creates a real bill."
- Unset: preview works (shows "Fire Recovery is switched off on this server"); submit refuses.
- **Tests:** all three modes.

### 7.6 Older incidents (D-19)

- Export Details shows "Export to NERIS again, then bill" when the report is Exported but no server receipt exists.
- The button runs the same export the report page uses, then opens the preview.
- **Before building it (blocker), the operator and agent check on staging:**
  - What NERIS does when an already-exported incident is exported again: update or duplicate. This is security fix 5b.
  - Whether the export endpoint accepts a re-export of an Exported report.
  - If NERIS duplicates, stop and ask the operator.

---

## 8. Front-end design

- **Export Details** (`src/App.tsx` about line 6036): replace the instant "Send to Fire Recovery" with a **Fire Recovery panel**:
  - status chip, tracking ID, invoice status, amount due, amount paid, last updated
  - **Preview & Send** (needs `billing.submit`)
  - **Update billing status** (needs `billing.submit`)
  - **Resolve review** (admin, shown only in Needs review)
  - the missing-fields list with a link to the report's Fire Recovery Billing tab
  - the re-export button (§7.6)
- **Preview modal:**
  - mode banner (§7.5)
  - department ID that will be used
  - call details
  - each party as a readable card
  - "Recommended, missing" list
  - buttons **Confirm and send** and **Cancel**
  - While sending, disable both buttons and show "Sending…". Repeat clicks are ignored in the browser too.
- **Resolve review modal (admin):** text "Log in to Recovery Hub and search for run number {X}." Two choices:
  - "Fire Recovery has it": enter the tracking ID; status becomes Sent.
  - "Fire Recovery does not have it": status becomes Failed, which allows resending.
- **Queue column and Fire Recovery list:** show the statuses from §7.4 instead of only `-` / `DataSent`.
- Use existing button and chip classes. Use style codes from `cursoragent-context.md` §6 (`QC`, `DD-S`, `RO-BOX`, `STAT-CHIP`, `SEC-H`).

---

## 9. Waves (build order). Tick boxes as you go

Each wave: lint + build + test, commit, push, add a line to §15. Promote to staging only at the points marked **Promote**.

### Wave 0 — Planning (done)
- [x] Review, questions, vendor docs saved, decisions recorded, this plan in the repo.

### Wave 1 — Sandbox switch (§7.5)
- [ ] `FIRE_RECOVERY_MODE` handling in the submit route; refuse when unset.
- [ ] Mode and department ID returned by the settings GET (for display).
- [ ] Tests: sandbox forces `FD12345678`; live refuses `FD12345678`; unset refuses.
- **Done when:** tests pass, and no code path can send a non-sandbox ID while the mode is `sandbox`.

### Wave 2 — Fire Recovery Billing tab (§5, §6)
- [ ] Shared requirements module plus unit tests.
- [ ] `fire_recovery_billing_json` metadata in `src/nerisMetadata.ts`.
- [ ] Tab UI in `NerisReportFormPage.tsx`, shown only for the D-2 types and read-only when locked.
- [ ] Copy from Person/Owner (resolve names at copy time; bug 2.1.6).
- [ ] Print summary block.
- [ ] Admin NERIS Required Fields: "Fire Recovery Billing" group saved as `fireRecoveryFieldRequirements`.
- [ ] Confirm the NERIS export payload is unchanged (compare `buildIncidentPayload` output before and after on a test report).
- **Done when:** a two-party vehicle accident can be filled, saved, printed and exported to NERIS with billing fields empty, and the chip shows what is missing.

### Wave 3 — Mapping and data source (§7.1–7.3)
- [ ] Read billing from the Exported draft plus the receipt.
- [ ] Rewrite the mapping as a pure function with unit tests: a two-party payload, uninsured, commercial, time format, personnel count, NERIS code not cut short.
- [ ] Server-side required-field check.
- **Done when:** unit tests show the exact vendor JSON for a sample report.

### Wave 4 — Preview, lock, safe results (§7.4)
- [ ] Needs §14 Q1 and Q2 answered first.
- [ ] Preview route + hash; submit with hash; atomic lock.
- [ ] Time limits; `Status 1` check; Sent / Failed / Needs review; never clear a tracking ID.
- [ ] Resolve-review route.
- [ ] Permission map entries plus tests (signed out 401; regular user 403; officer with grant allowed).
- **Done when:** fake-vendor tests (Wave 6) prove one bill per incident under double clicks, timeouts and errors.

### Wave 5 — Front end (§8)
- [ ] Export Details Fire Recovery panel, preview modal, resolve-review modal.
- [ ] Statuses in the queue column and the Fire Recovery list/detail.
- [ ] Update button with a time limit and a clear error.
- **Promote** Waves 1–5 to staging (pull request into `submenu/neris-golive-cifpd`; operator approves the merge).

### Wave 5b — Older incidents (§7.6)
- [ ] Staging check of NERIS re-export behaviour (operator with agent), recorded in `docs/plans/security-remediation-plan.md` under fix 5b.
- [ ] Re-export-then-bill button, only if the re-export updates cleanly.

### Wave 6 — Fake-vendor tests
- [ ] New `server/fireRecovery.test.mjs`, added to the `npm test` script in `package.json`.
- [ ] Start a local HTTP server and point `FIRE_RECOVERY_BASE_URL` at it.
- [ ] Cases: success; HTTP 400 refusal = Failed; HTTP 500 = Needs review; timeout = Needs review; 200 without `Status 1` = Needs review; double submit = one vendor call; resubmit after Sent refused; sandbox/live/unset; missing required field refused; another department's call number refused.
- [ ] Use the existing test database rule (`postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable`). Never point tests at Neon.

### Wave 7 — Staging sandbox test (operator, §11.2)
- [ ] Render settings on staging, login entered, two-party sandbox bill, billing status checked, double click checked, results recorded in §15.

### Wave 8 — Production release and first real bill (§11.3)
- [ ] Release checklist, settings, login, permissions, one real bill, results recorded.
- [ ] Then follow the "When this plan is complete" note at the top.

---

## 10. Files expected to change

- **Server:**
  - `server/fireRecoveryMapping.mjs` (rewrite)
  - `server/fireRecoveryClient.mjs` (time limits, `Status 1`)
  - `server/neris-proxy.mjs` (routes, about lines 3772–4290)
  - `server/auth/permissions.mjs` (new routes; approval)
  - new `server/fireRecovery.test.mjs`
- **Shared:** new `src/fireRecovery/billingRequirements.ts` (or `.mjs`), imported by both sides.
- **Front end:**
  - `src/pages/NerisReportFormPage.tsx` (tab, print)
  - `src/nerisMetadata.ts`
  - `src/App.tsx` (Export Details panel, required-fields admin group, queue column)
  - `src/pages/FireRecoveryIncidentsPage.tsx`, `src/pages/FireRecoveryIncidentDetailPage.tsx`, `src/api/fireRecovery.ts`
- **Schema (only if §14 Q1 = A):** `prisma/schema.prisma`, plus a new add-only migration folder.
- **Docs:** this plan, `docs/procedures/FIRE_RECOVERY_USA_API_REFERENCE.md`, `docs/plans/canvases/repair-plan.canvas.tsx`, `docs/task-2-multitenant-domain-plan.md`, `docs/procedures/RELEASE_CHECKLIST.md` (Fire Recovery steps), handoff files.

---

## 11. Operator steps (exact)

### 11.1 Create the credential key (do this at Wave 7, not before)

Repeat this separately for staging and production. Each gets its **own** key.

1. On your Mac, open **Terminal** and run:
   ```
   openssl rand -base64 48
   ```
   It prints one long line of random characters. Copy it.
2. Save that line in your password manager as "FIRE_RECOVERY_CREDENTIAL_KEY — staging" (or "— production"). If it's lost, the saved Fire Recovery password can't be read, and you'll need to re-enter it.
3. Open the Render dashboard, then **fireultimate-api-staging** (or **fireultimate-api-prod** at Wave 8), then **Environment**.
4. Add these settings with **Add Environment Variable**:
   - Key `FIRE_RECOVERY_CREDENTIAL_KEY`, value = the line from step 1.
   - Key `FIRE_RECOVERY_MODE`, value `sandbox` on staging (`live` on production, only at Wave 8).
5. Click **Save Changes**. Render redeploys. Wait until the service shows **Live**.
6. Do **not** add `NODE_ENV` in the dashboard (it breaks the build; see ACTIVE_CONTEXT).

### 11.2 Staging sandbox test (Wave 7)

1. Sign in at `https://cifpdil.staging.fireultimate.app` as an admin.
2. Go to **Admin Functions → Setup/Configuration → Fire Recovery**.
   - Enter the department name "Crescent Iroquois Fire Protection District".
   - Enter the Welcome email's username and password. Click **Save Fire Recovery**.
   - Expect "Fire Recovery settings saved." and "password is saved".
3. Create a test incident with type **MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION**. Fill the NERIS report.
   - On **Fire Recovery Billing**, add two parties: one insured, one with Uninsured checked. Use made-up names.
4. Export the report to NERIS.
5. Go to **Reporting → NERIS → View Exports**, open the incident, and look at the **Fire Recovery panel**.
   - Expect: yellow SANDBOX banner and department ID `FD12345678`.
6. Click **Preview & Send**. Check every value. Click **Confirm and send** twice quickly.
   - Expect: status **Sent**, one tracking ID, no error.
7. Click **Update billing status**. Expect a reply or a clear "not available yet" message. Write down what you see.
8. Try **Preview & Send** again. Expect it to refuse ("Already sent…").
9. Tell the agent the tracking ID and any messages. The agent records them in §15 and adds them to the vendor email.

### 11.3 Production release (Wave 8)

Follow `docs/procedures/RELEASE_CHECKLIST.md` in full:
- backup
- the 3 new migrations (plus any from §14 Q1)
- Crescent sender
- `NODE_ENV` handled by Render

Then:
1. Do §11.1 on **fireultimate-api-prod** with `FIRE_RECOVERY_MODE=live`.
2. Enter Crescent's real Fire Recovery login on the production site. If the vendor says the Welcome login is sandbox-only, wait for the real one.
3. Go to **Admin Functions** and grant officers "Send a NERIS report for billing" and "View billing information".
4. Choose one real, complete motor-vehicle incident. Preview, check the red LIVE banner, and Confirm.
5. Record the tracking ID in §15.
6. Check it in Recovery Hub.

---

## 12. Definition of done

- [ ] Staging: a two-party sandbox bill returned a tracking ID; double click sent one bill; resend refused.
- [ ] Tests: the Wave 6 cases pass in `npm test` and GitHub Actions.
- [ ] Production: Stage B + C released per the checklist; `FIRE_RECOVERY_MODE=live`; one real Crescent bill has a tracking ID, visible in Recovery Hub.
- [ ] Docs: this plan's §15 is filled in; the canvas copy, task-2 plan, API reference and handoff files are updated.
- [ ] Plan moved to `docs/plans/completed/` (see the top note).

---

## 13. Fire Recovery email (operator sends from `support@fireultimatehq.com` to `support@firerecoveryusa.com`)

> Subject: Fire Ultimate — NERIS incident billing API questions (Crescent Iroquois FPD)
>
> Hello,
>
> We are finishing Fire Ultimate's connection to Add NERIS Incident for Billing for Crescent Iroquois Fire Protection District, and will test with sandbox department ID FD12345678 first. Could you help with these questions?
>
> 1. Login: is the RH public API login in our Welcome email for the sandbox only, or also for Crescent's real bills?
> 2. Sandbox: please confirm that submissions with FD12345678 are never billed. Can sandbox incidents be cleared after testing?
> 3. Required fields: we send, per party, first and last name, address, Is Resident, insurance company (or uninsured), and vehicle make and model. We also send phone, policy number, insurance contact number, license plate and VIN when known. Is that enough? Which values does InvolvementType accept, and is it needed?
> 4. NERIS code: should IncidentType and PrincipleIncidentType hold the full NERIS incident type value (for example MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION)? Which format matches the NERIS Code dropdown in Recovery Hub?
> 5. Numbers: should our run number go in IncidentNumber, IncidentID, or both?
> 6. Dates: your examples have no time zone. Should we send the department's local time?
> 7. Commercial trucking: how do we mark a Commercial Trucking Incident through the API — CommercialVehicle on the party's vehicle, or something else?
> 8. Lost tracking ID: if our request times out, how do we find the tracking ID? Get Incident Tracking Id still lists a SubscriptionKey, and we do not have one.
> 9. Corrections: are corrections made only in Recovery Hub? How should a corrected report be matched to the original tracking ID?
> 10. Billing status: how soon after submitting is billing status available, and how often may we check it?
> 11. Law enforcement: if more than one agency reports, should we send one report number or several?
>
> Thank you,
> Jeremy Wichtner, Fire Ultimate

When answers arrive, update §3/§4 and the API reference, and adjust the mapping if needed.

---

## 14. Open questions (need the operator's answer before the named wave)

| # | Question | Needed before | Agent's recommendation |
|---|---|---|---|
| Q1 | Approve an add-only database change for billing status (`submitStatus`, `submitStartedAt`; optional attempt history table)? | Wave 4 | Yes: Option A (§7.4) |
| Q2 | Approve permission-map changes for the new routes (preview and submit = `billing.submit`; resolve-review = admin only)? | Wave 4 | Yes |
| Q3 | ~~Which report time is "Time Alarm Received"?~~ **Answered 2026-11-01:** call arrival at dispatch (`incident_time_call_arrival`) | — | — |
| Q4 | ~~Is "Run Number" Crescent's incident number?~~ **Answered 2026-11-01:** yes (`incident_internal_id`, e.g. `26-079`) | — | — |
| Q5 | Is the Welcome login also for real bills? | Wave 8 | Vendor email Q1 |

---

## 15. Progress log (newest last)

- 2026-11-01 — Plan written. Vendor docs saved (`docs/procedures/vendor/`). Blank Recovery Hub screenshot saved (`docs/plans/assets/phase-c-fire-recovery/`). Billing agreement confirmed. Render keys not yet created on staging or production.

---

## 16. Out of scope / later

- Attachments
- POP-score-style completeness score
- Address validation
- Search Incidents
- Structure Fire / Other run types
- Automatic billing status refresh
- Bulk status, payment reconciliation, totals
- Invoice and inspection billing
- Simplifying the Person/Owner tab (D-6)
- CAD Stage D
- Parked items in ACTIVE_CONTEXT
