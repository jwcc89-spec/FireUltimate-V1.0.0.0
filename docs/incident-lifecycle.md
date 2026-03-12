# Incident Lifecycle

This document explains how incidents move through the system and **when reports are created** and **when exports occur**. It is written for developers and AI agents so everyone follows the same mental model.

---

## Why this doc matters

- **For you (developer/agent):** So you don’t assume an Incident database table exists, and so you know where report and export logic belongs.
- **For continuity:** So the next agent knows: "Reports are created when the user submits the NERIS form" and "Exports happen when the user clicks Export and the app calls the API."

---

## Lifecycle overview (conceptual)

```
Dispatch received
       ↓
Incident (call) appears in app
       ↓
Units respond (dispatch workflow in UI)
       ↓
Incident resolved (status in UI)
       ↓
Report generated (user fills NERIS form)
       ↓
NERIS export (user clicks Export → API call)
       ↓
(Later) NEMSIS export — planned, not yet implemented
```

---

## Current implementation (what exists today)

- **Incidents** are **not** stored in a dedicated database table. They are used at the UI/API layer for:
  - **Queue display** — list of calls in the Incidents view.
  - **Incident detail views** — clicking a call opens the detail screen.
  - **NERIS report generation** — the report form is filled from incident/call context (e.g. incident number, dispatch info).

- **When reports are created:**  
  A report is created when the **user completes and submits the NERIS report form** for an incident. The form is tied to an incident/call in the UI; there is no separate "Report" table in the database today.

- **When exports occur:**  
  Export happens when the **user clicks Export** in the NERIS flow. The app sends the payload to **`POST /api/neris/export`**; the server proxy then talks to the NERIS API. There is no automatic background export unless you add it later.

---

## Do this now vs do this later

| Do this now | Do this later |
|-------------|----------------|
| Use incident data from the queue/detail UI and from the form context when building or fixing NERIS flows. | Do not add a new Incident or Report database table unless the user explicitly approves. |
| When adding or changing report/export behavior, follow this lifecycle (form submit → export API call). | Do not assume NEMSIS or CAD integration exists; they are planned. |
| Keep incident/report/export logic tenant-scoped (tenant from request host / `request.tenant`). | Do not add automatic or scheduled exports without explicit requirements. |

---

## Related docs

- **Architecture and data:** `docs/system_architecture.md`, `docs/data_model.md`.
- **External systems (NERIS, NEMSIS, CAD):** `docs/integrations.md`.
