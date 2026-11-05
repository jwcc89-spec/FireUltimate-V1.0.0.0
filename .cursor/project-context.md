# FireUltimate — Project Context

**Read this so you and all future agents stay on the same page.** This file gives the big picture and non-negotiable rules in one place.

---

## What this project is

FireUltimate is a **multi-tenant fire department operations platform**. Multiple fire departments (tenants) use the same app; each tenant’s data is strictly isolated. The stack is: React frontend (Vite), Node Express API (`server/neris-proxy.mjs`), and PostgreSQL via Prisma.

---

## Key constraints (do not break these)

1. **Tenant data must never mix.** Every tenant-scoped read and write must use `tenantId` (from `request.tenant.id`). No cross-tenant access.
2. **NERIS exports must match the official NERIS schema.** Do not change export payload shape or validation without approval.
3. **Incident/report data must remain auditable.** Do not silently overwrite or mix incident/report data across tenants. There is no Incident table yet — see `docs/incident-lifecycle.md`.
4. **All API routes must validate tenant identity.** Tenant comes from host (middleware); use it for every tenant-scoped endpoint. Admin routes use the platform admin key and body/params.
5. **Secrets stay off the client and out of payloadJson.** No API secrets (e.g. NERIS client secret) in frontend code. No auth secrets in `DepartmentDetails.payloadJson`. Use env and the server proxy.

---

## UI convention: time format (app-wide)

**All time inputs and displays use military (24-hour) format**, not AM/PM. This applies everywhere: NERIS form (Core onset, Incident Times, Resources, etc.), Incidents (create/edit, onset, any time fields), and any other screens. Use 24h (e.g. `HH:MM` or `HH:MM:SS`) consistently. When adding or changing time fields, follow this convention.

---

## Where to go next

- **Architecture and data:** `docs/system_architecture.md`, `docs/data_model.md`
- **Execution rules (preflight, batches, verification):** `docs/agent-execution-contract.md`, `cursoragent-context.md`
- **Incident flow, when reports/export happen:** `docs/incident-lifecycle.md`
- **External systems (CAD, NERIS, NEMSIS):** `docs/integrations.md`

---

## How to work (for you and future agents)

- **Do this now:** Read the docs above when they apply; give step-by-step, beginner-friendly directions; use **Now vs Later** so the next person knows what to do next.
- **Operator actions (in chat):** Use **exact** steps: full `cd` path + commands for terminal; UI paths and clicks. That is **not** the same as updating plan docs or `EMAIL_AND_CAD_SETUP.md` unless the user asked for doc edits. See `docs/agent-execution-contract.md` § 7 and `cursoragent-context.md` item 13.
- **Do this later:** Don’t add schema/migrations/auth changes or new integrations without explicit user approval. Don’t assume Incident, CAD, or NEMSIS exist until they’re implemented and documented.
