# Fire Recovery USA — Incident billing UX and implementation plan

**Status:** Approved product direction (2026-04-11).  
**Scope:** **Incidents for billing only.** A future surface **“Fire Recovery Inspections for Billing”** is out of scope for this document; naming here avoids confusion with that later work.

**Related:** Vendor API shapes — [docs/procedures/FIRE_RECOVERY_USA_API_REFERENCE.md](../procedures/FIRE_RECOVERY_USA_API_REFERENCE.md).  
**Integrations index:** [docs/integrations.md](../integrations.md).

---

## Goals

1. Let users **manually send** a NERIS-oriented incident export to **Fire Recovery USA** from the existing **Incident Export Queue** (per incident).
2. Show **Fire Recovery export status** on that queue in a dedicated column.
3. Provide a **dedicated list** of incidents that have been sent (or attempted) to Fire Recovery, with **billing fields** and **detail** behavior similar to the Incident Export Queue.
4. Allow **refreshing billing data** from Fire Recovery via **Get Incident Billing Status** (POST) from the detail view.

---

## 1. Incident Export Queue (existing screen)

### New column: **FireRecovery**

| State | Display | Style |
|--------|---------|--------|
| Not exported to Fire Recovery | `-` | Neutral (no accent color) |
| Exported successfully | `DataSent` | **Green** |

Failed or in-progress states can be added later (e.g. error text, retry); this plan locks the minimum: **not sent** vs **success**.

### Per-incident action: **Export to Fire Recovery**

- Each incident row includes a control (button or equivalent) to **manually trigger** the server call that submits the incident to Fire Recovery USA (same conceptual payload family as NERIS export / vendor “incident for billing”).
- Implementation detail: server obtains JWT, maps payload, POSTs to vendor; on success persist **tracking ID**, **export timestamp**, and status so the **FireRecovery** column and the **Fire Recovery Incidents for Billing** list stay in sync.

---

## 2. NERIS submenu — navigation

- Add a submenu control labeled **`FireRecovery`** placed **immediately to the left** of the existing **View Exports** button.
- **Primary label (user-facing):** Prefer **“Fire Recovery”** or **“Fire Recovery Incidents”** for clarity; internal route/slug can remain `fire-recovery` hyphenated. The screen title below uses the full billing name.

---

## 3. Screen: **Fire Recovery Incidents for Billing**

This is **not** the full Incident Export Queue; it is a **filtered list** of incidents that are part of the Fire Recovery workflow (exported or attempted—exact filter rule to be defined in implementation: e.g. “has any `FireRecoveryExport` row” or “success only” for v1; default assumption: **show all that have been submitted or attempted** so “last export attempt” is visible).

### List columns (v1)

| Column | Source (conceptual) |
|--------|----------------------|
| **Incident #** | App / NERIS incident identifier |
| **Incident Type** | From incident / export metadata |
| **Incident Date** | Incident date/time (app display, 24-hour clock per app standard) |
| **Export Date** | **Last** successful (or last attempt—**decide in implementation:** prefer **last successful send** for “Export Date”; store **last attempt** separately if we need both in UI later) |
| **Amount Due** | From persisted **Get Incident Billing Status** response (`InvoiceAmountDue` or equivalent) |
| **Amount Paid** | Derived or from vendor (e.g. **LastPaymentAmount**, or **InvoiceAmount − InvoiceAmountDue** when fully paid—**confirm with displayed vendor semantics** when wiring) |
| **Tracking ID** | Fire Recovery **incident tracking ID** returned on successful submit (or from **Get Incident Tracking Id** if we ever resolve by number/date) |

**Future columns:** Add after we confirm **all** fields returned by **POST Get Incident Billing Status** and any other vendor reads (see [API reference](../procedures/FIRE_RECOVERY_USA_API_REFERENCE.md) — e.g. `InvoiceID`, `InvoiceStatus`, `InvoiceSubmitDate`, `PaymentPlan`, `LastPaymentDate`).

### Row behavior

- Clicking a row opens a **detail** view **similar** to opening a report from the Incident Export Queue (same general patterns: metadata, history, last attempt, errors if we store them).

---

## 4. Detail view — **Fire Recovery Incidents for Billing**

### Header actions

- **Back** control: e.g. **“Back to Fire Recovery Incidents”** (or **“Back to View FR Incidents”** — match final copy in UI).
- **Update** button (beside Back): runs **POST Get Incident Billing Status** for this incident’s **Tracking ID**, then **persists** returned billing fields and **refreshes** the detail view and list columns.

No automatic polling required for v1 unless product asks for it later.

---

## 5. Data and API mapping (implementation notes)

- **Tenant isolation:** All reads/writes for Fire Recovery export rows and billing snapshots are **scoped by `tenant_id`**.
- **Secrets:** Fire Recovery API credentials stay in **`.env.server`** (and approved per-tenant storage if added later); **not** in `DepartmentDetails.payloadJson`.
- **Billing fields:** Persist vendor response from **Get Incident Billing Status** (`IncidentBillingStatusResponse` in vendor docs) so list and detail load without calling Fire Recovery on every page view—**Update** button forces refresh.

---

## 6. Out of scope (this phase)

- **Fire Recovery Inspections for Billing** (separate list, columns, and vendor inspection endpoints).
- Automatic export on NERIS export (unless explicitly added later).
- Inspection billing attachments.

---

## 7. Verification

- `npm run lint` and `npm run build` after implementation.
- Manual check: export from Incident Export Queue → column shows **DataSent** (green) → row appears under **Fire Recovery Incidents for Billing** → detail **Update** changes amounts when vendor data changes.

---

*Last updated: 2026-04-11 — aligned with product owner UX specification.*
