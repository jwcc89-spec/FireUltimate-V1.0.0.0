# FireUltimate Platform Architecture

## High-Level Overview

FireUltimate is a multi-tenant fire department operations platform that provides:

- **Incident tracking (UI workflow only — not yet persisted in DB)** — Call queue, incident detail view, and dispatch workflow states (Dispatched, Enroute, On scene, Transport, Cleared) in the UI.
- **NERIS fire reporting** — Incident-based report form, validation, and export via server-side proxy to NERIS API.
- **NEMSIS EMS reporting** — Planned; not yet implemented.
- **Dispatch workflow** — Dispatch notes and status in the incident UI; no external CAD system integration today.
- **Apparatus and personnel configuration** — Managed via Department Details (Admin); schedule assignments and department structure stored tenant-scoped.

Each fire department operates as an isolated **tenant**. Tenant is determined by request host (domain/subdomain) or defaults to the demo tenant on localhost.

---

## System Diagram

```
Browser
   │
   ▼
React Frontend (Vite)
   │
   ▼
Node Express API (server/neris-proxy.mjs)
   │
   ┌───────────────┬───────────────┐
   │ Tenant Logic  │ NERIS Proxy   │
   │               │               │
   │ users         │ validation    │
   │ schedules     │ export        │
   │ department    │ debug         │
   │ details       │               │
   └───────────────┴───────────────┘
   │
   ▼
PostgreSQL (Prisma ORM)
```

There is a single backend process; no additional services. Tenant logic and NERIS proxy live in the same Express app.

---

## Frontend

- **Stack:** React + TypeScript (Vite).
- **Routing:** React Router; auth at `/auth`, main app under sidebar modules.

**Key UI areas:**

| Area | Location | Notes |
|------|----------|--------|
| Incidents (queue, detail) | `src/App.tsx` | Inline components; incident data from appData / API |
| NERIS Reporting | `src/pages/NerisReportFormPage.tsx` | Form, queue, export via `/api/neris/*` |
| Department Details | `src/App.tsx` | DepartmentDetailsPage; apparatus/personnel/stations config |
| Personnel Schedule | `src/PersonnelSchedulePage.tsx` | Schedule UI; data from `/api/schedule-assignments` |
| Hydrants (Admin) | `src/HydrantsAdminPage.tsx` | Admin Functions → Hydrants |
| Other modules | `src/SubmenuPlaceholderPage.tsx` | Placeholder for menu items not yet built |

---

## Backend

- **Runtime:** Node.js.
- **Server:** Single Express app in `server/neris-proxy.mjs` — serves API and (in production) static frontend.

**Key behavior:**

- **Tenant resolution (middleware)** — Resolves tenant from `Host` / `X-Forwarded-Host` via `TenantDomain`; localhost → demo tenant. Sets `request.tenant` for all `/api/*` routes (except admin).
- **Auth** — `POST /api/auth/login`, `POST /api/auth/change-password`; session not shown in this doc (see implementation).
- **Tenant/config** — `GET /api/tenant/context`, `GET|POST /api/department-details` (tenant-scoped).
- **Users** — `GET|POST /api/users`, `PATCH|DELETE /api/users/:id`, `POST /api/users/:id/reset-password` (tenant-scoped).
- **Scheduling** — `GET|POST /api/schedule-assignments` (tenant-scoped).
- **NERIS** — `GET /api/neris/health`, `POST /api/neris/export`, `POST /api/neris/validate`, `GET /api/neris/debug/entities` (and related debug) — proxy to NERIS API with tenant-scoped entity/config.
- **Admin** — `POST /api/admin/tenants`, `POST /api/admin/tenants/:tenantId/domains` (protected by platform admin key).

---

## API Conventions

- Tenant-scoped endpoints use the pattern: `/api/<resource>`.
- Tenant context is set by middleware: **`request.tenant.id`** (and `request.tenant.slug`, etc.). Do not trust tenant from the request body for scoping.
- All tenant-scoped queries must filter by `tenantId` from `request.tenant.id`.

**Example:**

```js
prisma.user.findMany({
  where: { tenantId: request.tenant.id },
});
```

- **Admin routes** (`/api/admin/*`) are protected by the platform admin key (header). Tenant is identified by body or URL params, not by host-derived `request.tenant` alone.

---

## Database

- **Engine:** PostgreSQL.
- **ORM:** Prisma (`prisma/schema.prisma`).

**Primary entities (all tenant-scoped where applicable):**

| Model | Purpose |
|-------|---------|
| Tenant | Tenant record; slug, name, status, optional `nerisEntityId` |
| TenantDomain | Hostname → tenant mapping for domain-based routing |
| User | Tenant-scoped auth; username, passwordHash, role |
| DepartmentDetails | One per tenant; `payloadJson` holds department config — do not store auth secrets here |
| ScheduleAssignments | Tenant-scoped schedule data by shiftType and dateKey |

---

## Data Storage Strategy

FireUltimate uses two storage patterns.

### Relational tables (Prisma)

Used for core platform entities:

- Tenant
- TenantDomain
- User
- DepartmentDetails
- ScheduleAssignments

These are normal database tables with `tenantId` (where applicable).

### Structured JSON storage

Department-specific configuration is stored in **`DepartmentDetails.payloadJson`**.

This JSON object holds collections such as:

- apparatus (units, types, stations)
- personnel (scheduling / department roster)
- stations
- qualifications
- shift configuration
- user types, mutual aid options, and related config

**Stored key names** include `stationRecords`, `masterApparatusRecords`, `schedulerPersonnelRecords`, `shiftInformationEntries`, and others — see **`docs/data_model.md`** for exact keys and shapes.

**Agents must not assume these collections are separate database tables.** There are no `Incident`, `Apparatus`, or `Personnel` tables today.

---

## Incident Data (Current State)

Incidents are handled at the UI/API layer and are **not persisted as a dedicated database table**.

Incident data is used for:

- queue display
- incident detail views
- NERIS report generation (form is filled from incident/call context)

Future architecture may introduce a relational Incident table. **Agents must not assume one currently exists.**

---

## Tenant Strategy

- **Resolution:** Tenant is determined by request host (via `TenantDomain`). Localhost uses the `demo` tenant.
- **Scoping:** All domain data is tenant-scoped. Every query that reads or writes tenant-specific data must use `tenantId` (from `request.tenant.id`).
- **Convention:** All domain entities that belong to a tenant have a `tenantId` column and an index on `tenantId`. No cross-tenant data access.

For detailed multi-tenant and domain setup, see `docs/task-2-multitenant-domain-plan.md`.

---

## Security Rules

- Passwords must be stored using **bcrypt** hashing (never plain text).
- **Secrets must never be stored in `DepartmentDetails.payloadJson`.** Auth lives in the `User` table and env/config only.
- Tenant isolation must be **enforced server-side** on every tenant-scoped read/write.
- Client code must **not** contain API secrets (e.g. NERIS client secret). Use the server proxy and env vars.

---

## Important Files

| Purpose | Path |
|--------|------|
| Frontend entry / main app and routing | `src/App.tsx` |
| NERIS reporting UI | `src/pages/NerisReportFormPage.tsx` |
| Backend server (API + tenant + NERIS proxy) | `server/neris-proxy.mjs` |
| Database schema | `prisma/schema.prisma` |
| Tenant creation script | `scripts/tenant-create.ts` |

---

## Planned Modules (Not Yet Implemented)

The following are planned but **not** currently implemented:

- NEMSIS EMS reporting
- CAD / dispatch system integration
- Persistent incident database (relational Incident table)
- GIS routing / mapping

Agents should not assume these systems or tables exist. Do not add code that depends on them without explicit approval.
