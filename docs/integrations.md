# Integrations

This document describes how FireUltimate connects to **external systems**. It is the single place to check what is integrated today and what is planned. Use it so agents don’t invent or assume integrations that don’t exist.

---

## Why this doc matters

- **For you (developer/agent):** So you don’t add code that depends on CAD, NEMSIS, or other systems before they are implemented.
- **For continuity:** So the next agent knows exactly where the NERIS proxy lives, how auth works, and which endpoints to use.

---

## CAD (Computer-Aided Dispatch)

| Status | Notes |
|--------|--------|
| **Not integrated** | No CAD system is connected today. Dispatch workflow (states, notes) exists in the UI only. Do not assume a CAD API or database exists. |

**Do this now:** Use only in-app incident/call data and UI state.  
**Do this later:** When CAD integration is approved, add it here and in architecture docs.

---

## NERIS (Fire reporting)

| Item | Details |
|------|--------|
| **Status** | Integrated via server proxy. |
| **Server** | `server/neris-proxy.mjs` — same Express app that handles tenant resolution, auth, and API routes. |
| **Auth** | Client credentials (recommended) or password flow. Stored in env (e.g. `.env.server`), not in frontend. |
| **Env vars (typical)** | `NERIS_ENTITY_ID`, `NERIS_GRANT_TYPE`, `NERIS_CLIENT_ID`, `NERIS_CLIENT_SECRET`; for password flow also `NERIS_USERNAME`, `NERIS_PASSWORD`. See `.env.server.example`. |
| **Entity ID** | Stored per tenant: **`Tenant.nerisEntityId`**. Used for export and entity-scoped API calls. |
| **Export** | **`POST /api/neris/export`** — frontend sends payload; proxy forwards to NERIS API. |
| **Other endpoints** | `GET /api/neris/health`, `POST /api/neris/validate`, `GET /api/neris/debug/entities`, `GET /api/neris/debug/entity-check`, `GET /api/neris/debug/incident` (see `docs/system_architecture.md`). |

**Do this now:** Use the proxy and `Tenant.nerisEntityId`; keep secrets in env only.  
**Do this later:** Don’t add new NERIS endpoints or auth methods without approval.

---

## Fire Recovery USA (NERIS billing handoff)

| Item | Details |
|------|--------|
| **Status** | In progress / planned — UX and screens: [plans/FIRE_RECOVERY_INCIDENT_BILLING_UX_PLAN.md](plans/FIRE_RECOVERY_INCIDENT_BILLING_UX_PLAN.md). Vendor API: [FIRE_RECOVERY_USA_API_REFERENCE.md](procedures/FIRE_RECOVERY_USA_API_REFERENCE.md). |
| **Vendor docs** | [https://doc.firerecoveryusa.com/](https://doc.firerecoveryusa.com/) — **Add NERIS Incident for Billing** (confirm exact title in portal). The portal is browser-rendered; copy endpoint details into the reference doc. |
| **Secrets** | API keys in `.env.server` (or approved per-tenant secrets strategy). Not in `DepartmentDetails.payloadJson`. |
| **Support** | support@firerecoveryusa.com |

**Do this now:** Read the reference procedure; fill the “API details to capture” table from the vendor site before locking request/response shapes in code.  
**Do this later:** Keep this section and the reference doc aligned with shipped routes and env vars.

---

## NEMSIS (EMS reporting)

| Status | Notes |
|--------|--------|
| **Planned; not implemented** | No NEMSIS integration yet. Do not add NEMSIS API calls, tables, or UI that depend on NEMSIS until it is approved and documented here. |

**Do this now:** Omit NEMSIS from implementation unless explicitly asked.  
**Do this later:** When NEMSIS is added, update this section and `docs/incident-lifecycle.md`.

---

## Summary table

| System | Integrated? | Where to look |
|--------|-------------|----------------|
| CAD | No | — |
| NERIS | Yes | `server/neris-proxy.mjs`, `Tenant.nerisEntityId`, `POST /api/neris/export` |
| Fire Recovery USA | In progress / planned | [procedures/FIRE_RECOVERY_USA_API_REFERENCE.md](procedures/FIRE_RECOVERY_USA_API_REFERENCE.md) |
| NEMSIS | No (planned) | — |

---

## Related docs

- **Architecture:** `docs/system_architecture.md`
- **Data model (tenant, entity ID):** `docs/data_model.md`
- **When reports and exports happen:** `docs/incident-lifecycle.md`
