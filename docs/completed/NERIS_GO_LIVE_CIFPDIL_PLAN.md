# NERIS Go-Live Plan: Tenant cifpdil (Live Account + Live NERIS Submissions)

**Branch:** `submenu/neris-golive-cifpd`  
**Goal:** Ensure tenant **cifpdil** (Crescent-Iroquois Fire Protection District - IL) is created, active, and can submit NERIS reports through the NERIS menu on the **live** Fire Ultimate app (not `*staging.fireultimate.app`). Switch NERIS from test API to production API and successfully push a live report.

**Alignment:** This plan is aligned with:
- **submenu--departmentdetails-ui:** DD-M, DD-S, CLICKABLE-LIST, NERIS form conventions, tenant-domain routing.
- **submenu--neris-all:** NERIS form and proxy behavior (required/minimum matrix, conditional validation by incident family, Resource Times "Populate Date", **Department NERIS ID auto-fill from Admin Vendor/Department Code**, aid-flow RL logic, Cross Street RL fields, personnel de-duplication, payload mapping). See `agent-handoffs/branches/submenu--neris-all/ACTIVE_CONTEXT.md` and sessions/conversations there.

---

## 1. Is the live NERIS URL the same for all tenants?

**Yes.** Per project documentation and NERIS multi-tenant design:

- **README.md:** “For production accounts: `NERIS_BASE_URL=https://api.neris.fsri.org/v1`”
- **docs/task-2-multitenant-domain-plan.md (NERIS Multi-Tenant Credentials):** “Keep global in env: `NERIS_BASE_URL` (shared if same for all tenants)”
- **Conversation (2026-03-06):** “each department will have their own entity ID, Neris ID, client ID and Client Secret and **common NERIS_BASE_URL**” and “keep `NERIS_BASE_URL` global”

So: **one production base URL for all tenants** — `https://api.neris.fsri.org/v1`. Per-tenant values are: Entity ID, Department NERIS ID, Client ID, Client Secret (stored per tenant when that is implemented; for now they can be in `.env.server` for the single live tenant).

---

## 2. Plan overview (step-by-step)

| Phase | What | Doc / Where |
|-------|------|--------------|
| **Phase 1** | Get cifpdil tenant **live** (exists, active, reachable at cifpdil.fireultimate.app) | **`docs/PHASE_1_CIFPDIL_TENANT_LIVE.md`** — runbook with exact commands and verification |
| Phase 2 | Switch NERIS to **live** API | Set `NERIS_BASE_URL=https://api.neris.fsri.org/v1` + live credentials in prod env (e.g. Render) |
| Phase 3 | NERIS form fields | Align Department NERIS ID, Entity ID, required fields (Section 3.4) |
| Phase 4 | Push a live report | Reporting → NERIS; Export; confirm success (Section 3.5) |

---

## 3. Step-by-step directions

### 3.1 Create or ensure the **live** cifpdil tenant (not staging)

**Context:** Staging already has `cifpdil.staging.fireultimate.app` → tenant `cifpdil`. For “live” you need the same tenant (or a dedicated prod tenant) reachable at **production** hostname and status **active**.

**Option A — Tenant already exists (e.g. from seed or staging):**

1. Check current tenants and domains (from project root, with `DATABASE_URL` in env, e.g. `.env` or `.env.server`):
   ```bash
   node --env-file=.env.server --input-type=module -e "
   import { PrismaPg } from '@prisma/adapter-pg';
   import pkg from '@prisma/client';
   import { Pool } from 'pg';
   const { PrismaClient } = pkg;
   const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
   const list = await prisma.tenant.findMany({
     include: { domains: true },
     orderBy: { slug: 'asc' }
   });
   console.log(JSON.stringify(list, null, 2));
   await prisma.\$disconnect();
   "
   ```
2. If **cifpdil** exists but only has `cifpdil.staging.fireultimate.app`:
   - Add production domain (see 3.1 Option B step 2).
3. Set tenant status to **active** if it is not already:
   - Either via DB update or (when available) an admin API PATCH for tenant status.
   - In Prisma: `Tenant.status` must be `active` for production use.

**Option B — Create live cifpdil tenant from scratch (no existing cifpdil):**

1. **Create tenant + primary domain + admin user** (use production hostname for “live”):
   ```bash
   npm run tenant:create -- \
     --slug cifpdil \
     --name "Crescent-Iroquois Fire Protection District - IL" \
     --hostname cifpdil.fireultimate.app \
     --status active \
     --adminUsername admin \
     --adminPassword <CHOOSE_SECURE_PASSWORD>
   ```
   - **What this does:** Creates one row in `Tenant` (slug `cifpdil`, status `active`), one row in `TenantDomain` (hostname `cifpdil.fireultimate.app`, isPrimary true), and an admin user for that tenant. No staging hostname is added by this command.
2. **If you need both staging and production hostnames** for the same tenant (e.g. same DB for staging and prod):
   - Create tenant once with **one** hostname (e.g. `cifpdil.fireultimate.app`).
   - Add the second hostname via Admin API:
     ```bash
     curl -X POST https://<YOUR_PROD_OR_STAGING_API>/api/admin/tenants/<TENANT_ID>/domains \
       -H "Content-Type: application/json" \
       -H "X-Platform-Admin-Key: <PLATFORM_ADMIN_KEY>" \
       -d '{"hostname":"cifpdil.staging.fireultimate.app","isPrimary":false}'
     ```
   - Replace `<YOUR_PROD_OR_STAGING_API>`, `<TENANT_ID>`, and `<PLATFORM_ADMIN_KEY>` with your values.

**Verification:**

- `GET https://cifpdil.fireultimate.app/api/tenant/context` (or your prod base URL with host `cifpdil.fireultimate.app`) returns `tenant.slug === "cifpdil"` and `tenant.status === "active"` (if exposed).
- Login at `https://cifpdil.fireultimate.app` with the cifpdil admin user.

---

### 3.2 DNS and SSL for production (reference, primarily covered in Phase 1)

- In your DNS provider (e.g. Cloudflare):
  - **Wildcard:** `*.fireultimate.app` → CNAME to your **production** app host (e.g. Render prod service).
- Ensure SSL covers `*.fireultimate.app` (or at least `cifpdil.fireultimate.app`).
- See `docs/wave-6-domain-routing-runbook.md` for host/tenant verification steps; use production URLs instead of staging.

---

### 3.3 Switch NERIS from test to **live** API

**Current (test):** `NERIS_BASE_URL=https://api-test.neris.fsri.org/v1` (or `https://api-tes.neris.fsri.org/v1` if that was a typo for api-test).

**Target (live):** `NERIS_BASE_URL=https://api.neris.fsri.org/v1`

**Steps:**

1. **Obtain live NERIS credentials** from NERIS (production OAuth client ID/secret and, if applicable, Entity ID / Department NERIS ID for the department). Use NERIS documentation or vendor contact.
2. **Production environment** (e.g. Render prod or your prod server):
   - Open the env config used by the proxy (e.g. Render “Environment” or server `.env.server`).
   - Set:
     - `NERIS_BASE_URL=https://api.neris.fsri.org/v1`
     - `NERIS_ENTITY_ID=<live entity ID>`
     - `NERIS_CLIENT_ID=<live client id>`
     - `NERIS_CLIENT_SECRET=<live client secret>`
     - `NERIS_GRANT_TYPE=client_credentials` (unless NERIS specifies otherwise)
   - Optional fallback for Department NERIS ID if form field is empty: `NERIS_DEPARTMENT_NERIS_ID=<live department NERIS ID>`.
3. **Restart the proxy** so it reads the new env (e.g. redeploy on Render or restart `npm run proxy` locally).
4. **Sanity check:**  
   `GET /api/neris/health` should succeed against `https://api.neris.fsri.org/v1`.  
   For entity verification, use `GET /api/neris/debug/entity-check?nerisId=FD########` (which checks `/entity?neris_id=...`, `/entity/{neris_id}`, and enrollment lookup) instead of treating `/debug/entities` as an authorization gate.

**Important:** Test credentials will not work against the production URL; production credentials must be used with `https://api.neris.fsri.org/v1`.

---

### 3.4 NERIS form fields (align as needed)

- **Department NERIS ID:** Must match the live department’s NERIS ID (FD format, e.g. FD########). **Auto-fill:** On `submenu/neris-all`, Department NERIS ID is auto-filled from Admin Vendor/Department Code (see `agent-handoffs/branches/submenu--neris-all` ACTIVE_CONTEXT and conversations). Ensure Admin Customization (or Department Details) has the correct Vendor/Department Code for the live department so the NERIS form gets the right Department NERIS ID. Fallback in proxy: `NERIS_DEPARTMENT_NERIS_ID` in env.
- **Entity ID:** Sent in `X-NERIS-Entity-ID` by the proxy; must be the **live** entity ID for the tenant (currently from env; later from tenant-scoped storage).
- **Required/core fields:** Per `src/nerisMetadata.ts` and NERIS schema (e.g. `NERIS_REQUIRED_FIELD_MATRIX`, `NERIS_FORM_FIELDS`). Ensure at least:
  - Incident number, onset date/time, dispatch run number
  - Primary incident type, dispatch/incident location
  - Call created/answered/arrival times, primary unit ID
  - Narrative outcome
  - Any conditional required fields (e.g. Fire/HAZSIT/Medical) per incident type.
- **Styling:** Keep alignment with Department Details UI patterns from `submenu--departmentdetails-ui` (DD-S, DD-M, CLICKABLE-LIST, etc.) as in `cursoragent-context.md` and handoff notes.

**References:**

- NERIS schema/docs: `src/nerisMetadata.ts` → `NERIS_SCHEMA_REFERENCE_LINKS` (e.g. https://neris.fsri.org/technical-reference, https://api.neris.fsri.org/v1/openapi.json).
- Form metadata: `NERIS_FORM_FIELDS`, `NERIS_REQUIRED_FIELD_MATRIX` in `src/nerisMetadata.ts`.

---

### 3.5 Successfully push a live report to NERIS

1. **Environment:** App and proxy must be using **production** config: production URL for the app (e.g. `https://cifpdil.fireultimate.app`) and proxy env with `NERIS_BASE_URL=https://api.neris.fsri.org/v1` and **live** credentials.
2. **Login:** Sign in as cifpdil admin at the **live** tenant URL (e.g. `https://cifpdil.fireultimate.app`).
3. **Reporting → NERIS:** Open the NERIS report form (Incident Report Queue / create or open an incident).
4. **Fill required fields** (see 3.4); ensure Department NERIS ID and any entity/ID fields match live NERIS.
5. **Export:** Click Export; the app sends the payload to `/api/neris/export`; the proxy uses live base URL and credentials to POST to NERIS production.
6. **Success:** Response should include NERIS incident ID or success confirmation from the live API. If you get 4xx/5xx or validation errors, check proxy logs and NERIS error body; fix credentials or payload (required fields, formats) per NERIS docs.

---

## 4. Checklist summary

- [ ] **Live tenant:** cifpdil exists with status `active` and production hostname `cifpdil.fireultimate.app` (or equivalent).
- [ ] **DNS/SSL:** Production wildcard/subdomain and SSL in place for `cifpdil.fireultimate.app`.
- [ ] **NERIS URL:** Production env has `NERIS_BASE_URL=https://api.neris.fsri.org/v1` (same for all tenants).
- [ ] **NERIS credentials:** Live Entity ID, Client ID, Client Secret (and optional Department NERIS ID) set in production env; proxy restarted/redeployed.
- [ ] **Form fields:** Department NERIS ID and required/core fields aligned with NERIS schema and pre-filled where applicable.
- [ ] **Live push:** One report submitted via Reporting → NERIS and accepted by NERIS production API.

---

## 5. References

- **Beginner guide (tenants, NERIS, branches):** `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/TENANTS_NERIS_AND_BRANCHES_EXPLAINED.md` — Where NERIS_ENTITY_ID lives today vs per-tenant, how demo + api-test testing works, branches vs tenants vs environments.
- `cursoragent-context.md` — UI patterns, branch handoff, NERIS form behavior.
- **submenu--neris-all:** `agent-handoffs/branches/submenu--neris-all/ACTIVE_CONTEXT.md`, `sessions/*.md`, `conversations/*.md` — NERIS form/proxy implementation (required matrix, conditional validation, Department NERIS ID auto-fill from Admin Vendor/Department Code, aid-flow RL, Cross Street RL, Resource Times Populate Date, personnel de-duplication, mapping).
- **submenu--departmentdetails-ui:** `ACTIVE_CONTEXT.md`, `sessions/*.md`, `conversations/*.md` — Staging tenant routing, scheduler/UI state, Wave 6/7/8, NERIS/auth.
- `docs/task-2-multitenant-domain-plan.md` — Tenant slugs, domains, NERIS multi-tenant credentials (global base URL).
- `docs/wave-6-domain-routing-runbook.md` — DNS, SSL, tenant-context verification.
- `README.md` — NERIS proxy config (test vs production base URL).
- `src/nerisMetadata.ts` — NERIS schema links, required fields, form metadata.
