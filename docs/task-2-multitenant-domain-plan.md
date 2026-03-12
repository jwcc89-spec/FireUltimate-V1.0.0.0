# Task 2 Plan: Multi-Tenant + Domain-Based Setup

## Goal (Plain English)

Build the app so multiple fire departments can use the same software safely, each with isolated data, while supporting:

- global product updates to all departments,
- tenant-specific configuration/customization,
- domain-based tenant routing (no tenant dropdown required).

Initial tenants:

- `Crescent-Iroquois Fire Department`
- `DEMO` (sample data tenant for demos/sales)

Execution contract for all agents/models:

- `docs/agent-execution-contract.md`

---

## Quick Definitions

- **Database (DB):** where app data is stored reliably and shared across devices/users.
- **PostgreSQL:** the database engine.
- **Prisma:** tool that helps backend code read/write PostgreSQL data safely and with less boilerplate.
- **Tenant:** one agency/customer account (e.g., Crescent, Demo).
- **Domain-based tenancy:** tenant is determined by request host/subdomain, e.g. `crescent.yourdomain.com`.

---

## Target Architecture

- One codebase (frontend + backend)
- Multi-tenant database with strict `tenant_id` scoping
- Domain/subdomain decides tenant
- Shared global deploy pipeline
- Tenant-specific behavior controlled by config/data (not code forks)

---

## Naming Convention (Standard)

Use lowercase + hyphens for infrastructure/service names, and short stable tenant slugs.

### Environment names

- `dev` = local development
- `staging` = pre-production validation
- `prod` = live production

### Tenant slugs

Use permanent short slugs:

- Crescent-Iroquois Fire Department -> `crescent`
- DEMO -> `demo`
- Frankfort FD -> `frankfort`
- Kankakee FD -> `kankakee`

Rules:

- lowercase only
- no spaces
- no special characters
- do not change slug once used in production

### Domain/subdomain pattern

Production:

- `<tenant>.fireultimate.app`
  - `crescent.fireultimate.app`
  - `demo.fireultimate.app`

Staging:

- `<tenant>.staging.fireultimate.app`
  - `crescent.staging.fireultimate.app`
  - `demo.staging.fireultimate.app`

### Render service names

Backend/API:

- `fireultimate-api-staging`
- `fireultimate-api-prod`

Frontend/web (if separate):

- `fireultimate-web-staging`
- `fireultimate-web-prod`

Optional worker/cron:

- `fireultimate-worker-staging`
- `fireultimate-worker-prod`

### Neon/PostgreSQL project naming

Projects:

- `fireultimate-staging`
- `fireultimate-prod`

Database names:

- `fireultimate_staging`
- `fireultimate_prod`

### Environment variable naming

Core:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `SESSION_SECRET`
- `CORS_ALLOWED_ORIGINS`

Frontend:

- `VITE_API_BASE_URL`

Optional domain/tenant:

- `PRIMARY_DOMAIN=fireultimate.app`
- `STAGING_DOMAIN=staging.fireultimate.app`
- `DEFAULT_TENANT_SLUG=demo`

### Git branch naming

- Feature: `feature/<scope>-<topic>`
  - Example: `feature/task2-tenant-domain-middleware`
- Fix: `fix/<scope>-<topic>`
- Infra: `infra/<topic>`

### Migration naming

Use timestamp-like prefix + short description:

- `20260308_init_tenants`
- `20260308_add_tenant_domains`
- `20260309_department_details_tenant_scope`

---

## Phase 0 — Decisions (Do First)

1. Choose production domain (example: `fireultimate.app`).
2. Confirm subdomain pattern:
   - `crescent.fireultimate.app`
   - `demo.fireultimate.app`
3. Confirm infrastructure:
   - DB: Neon (PostgreSQL)
   - App/API host: Render (or Railway/Fly)
   - DNS provider: Cloudflare (recommended) or existing provider
4. Decide environment names
        -staging (first live test)
        -production (real use)
    Suggested Project Naming:
    -Neon DB:
        -fireultimate-staging-db
        -fireultimate-prod-db
    -Render services:
        -fireultimate-api-staging
        -fireultimate-web-staging

**Exit criteria:**
- Domain + hosting choices are final for this implementation pass.

Final domain: fireultimate.app
DNS Provider: Cloudflare
DB host: Neon (PostgreSQL)
App host: Render
Tenant subdomains(planned):
    cifpdil (Crescent-Iroquois Fire Protection District - IL)
    demo (Demo Account for all)
DEMO policy:
    persistent sandbox (no automatic reset).

---

## Tenant Strategy and Status (Standard)

- **demo:** shared sandbox; persistent; no auto-reset.
- **Trial tenants:** per-agency (e.g. `kankdemo`, `watsekademo`); persistent; no auto-reset unless manually archived.
- **Production tenants:** canonical agency slugs (e.g. `cifpdil`, `watsekafd`).

**Tenant.status** (allowed values; stored in DB):

- `sandbox` — shared demo sandbox
- `trial` — dedicated trial for a prospect
- `active` — live production tenant
- `suspended` — temporarily disabled
- `archived` — no longer active, data retained

**Decision:** No automatic reset of the demo tenant; demo is a persistent sandbox.

---

## Operator Runbook (Tenant Lifecycle)

Use these steps when creating or managing tenants. Prefer the `tenant:create` script or the admin API when available.

### Create tenant (CLI script)
Run: `npm run tenant:create -- --slug <slug> --name "<Name>" --hostname <host>.<env>.fireultimate.app --status trial --adminUsername admin --adminPassword <temp>`  
Script creates: tenant, primary domain, empty DepartmentDetails, admin user (bcrypt). Status may be: `sandbox`, `trial`, `active`, `suspended`, `archived`.

### Create tenant (Admin API)

**What the Admin API is:** HTTP endpoints that only work when you send a secret key. They let you create tenants and add domains over the network (e.g. from another machine or a future UI) instead of running the CLI script on the server.

**Beginner guide:** If you are new to coding, use **docs/admin-api-beginner-guide.md**. It explains from scratch: what `.env.server` is, what a "header" is, what "restart the proxy" means, and exactly where to type each command and what you’ll see.

**Step-by-step: How to use the Admin API**

1. **Open your server environment file**  
   In the project root, open `.env.server` in your editor. (If it doesn’t exist, copy `.env.server.example` to `.env.server` first.)

2. **Add or set the platform admin key**  
   Add a single line (or change the existing one) to set a secret of your choice, for example:
   ```bash
   PLATFORM_ADMIN_KEY=your-secret-key-here-make-it-long-and-random
   ```
   Replace `your-secret-key-here-make-it-long-and-random` with a long, random string only you (and your team) know. This is like a password for the admin API. Example: `PLATFORM_ADMIN_KEY=abc123def456-secure-key-xyz`.

3. **Save the file**  
   Save `.env.server` and close it.

4. **Restart the proxy server**  
   The server reads `.env.server` only when it starts. So:
   - In the terminal where `npm run proxy` is running, press `Ctrl+C` to stop it.
   - Run `npm run proxy` again.
   After this, the server will use the new `PLATFORM_ADMIN_KEY` value.

5. **Call the admin endpoints with the key in the request**  
   Every request to `/api/admin/*` must include that secret so the server knows you’re allowed to use the admin API. You can send it in either of these ways:
   - **Header (recommended):** `X-Platform-Admin-Key: your-secret-key-here-make-it-long-and-random`
   - **Authorization header:** `Authorization: Bearer your-secret-key-here-make-it-long-and-random`

   **Example: create a tenant with curl**  
   In a new terminal (with the proxy already running), run (replace the key and body with your values):
   ```bash
   curl -X POST http://localhost:8787/api/admin/tenants \
     -H "Content-Type: application/json" \
     -H "X-Platform-Admin-Key: your-secret-key-here-make-it-long-and-random" \
     -d '{"slug":"kankdemo","name":"Kankakee Trial","hostname":"kankdemo.staging.fireultimate.app","status":"trial","adminUsername":"admin","adminPassword":"tempPassword123"}'
   ```
   If the key matches `PLATFORM_ADMIN_KEY` in `.env.server`, you get a 201 response and the tenant is created. If the key is wrong or missing, you get 403 and nothing is created.

   **Example: add a domain to an existing tenant**  
   Replace `TENANT_ID` with the tenant’s id (from the create response or database):
   ```bash
   curl -X POST http://localhost:8787/api/admin/tenants/TENANT_ID/domains \
     -H "Content-Type: application/json" \
     -H "X-Platform-Admin-Key: your-secret-key-here-make-it-long-and-random" \
     -d '{"hostname":"kankdemo.fireultimate.app","isPrimary":false}'
   ```

**Summary:** Put the secret in `.env.server` as `PLATFORM_ADMIN_KEY`, restart the proxy, then send that same value on every admin request in the `X-Platform-Admin-Key` (or `Authorization: Bearer`) header.

- **POST /api/admin/tenants** — body: `{ slug, name, hostname, status?, adminUsername, adminPassword }`. Creates tenant, primary domain, DepartmentDetails, admin user.
- **POST /api/admin/tenants/:tenantId/domains** — body: `{ hostname, isPrimary? }`. Adds a domain to an existing tenant.

### Create tenant (manual)
- Insert row in `Tenant` (slug, name, status).
- Use slug format: production = agency slug (`cifpdil`); trial = agency + `demo` (`kankdemo`); sandbox = `demo`.

### Assign domain (manual)
- Insert row in `TenantDomain` (tenantId, hostname, isPrimary).
- Hostname pattern: `<tenant>.<env>.fireultimate.app` (e.g. `kankdemo.staging.fireultimate.app`).
- Add DNS record so hostname resolves to app host.

### Seed admin user
- Insert row in `User` (tenantId, username, passwordHash via bcrypt, role `admin`).
- Ensure no auth secrets are stored in `DepartmentDetails.payloadJson`.

### Suspend tenant
- Set `Tenant.status` to `suspended`. App should deny or limit access for that tenant.

### Archive tenant
- Set `Tenant.status` to `archived`. Optionally retain data; do not delete tenant row if referential integrity or audit trail is needed.

---

## Phase 1 — Database Foundation

4. Create Neon PostgreSQL project.
5. Add `DATABASE_URL` env variable.
6. Install Prisma and initialize schema.
7. Add initial models:
   - `Tenant`
   - `TenantDomain`
   - `User`
   - `DepartmentDetails`
   - `ScheduleAssignments`
8. Run first migration.

**Exit criteria:**
- DB tables exist and migration is committed.

---

## Phase 2 — Seed Initial Tenants + Data

9. Create seed script.
10. Insert tenants:
    - `crescent_iroquois_fd`
    - `demo`
11. Insert domain mappings:
    - `crescent.<domain>`
    - `demo.<domain>`
12. Insert initial users per tenant.
13. Seed sample data for DEMO.

**Exit criteria:**
- Both tenants, domain mappings, and starter users/data exist.

---

## Phase 3 — Domain-Based Tenant Resolution

14. Add backend middleware to read `req.hostname`.
15. Resolve hostname via `TenantDomain` table.
16. Attach resolved `tenant_id` to request context.
17. Return clear error if host is unknown.

**Exit criteria:**
- Every API request has a resolved tenant context from domain.

---

## Phase 4 — Auth + Session Tenant Binding

18. Update login flow:
    - tenant comes from host (not manual dropdown)
19. Store `tenant_id` in session/JWT.
20. Verify session tenant matches request tenant on protected routes.
21. **Password hashing (done):** User passwords are stored and verified with bcrypt (`bcryptjs`). Seed script stores hashed passwords for `admin`/`demo`. Login accepts both bcrypt hashes and legacy plaintext; on successful plaintext login the stored value is auto-upgraded to a bcrypt hash.
22. **Wave 3 (done):** Dedicated `/api/users` (GET list, POST create, PATCH update, DELETE). Login uses `User` table only (no payload fallback). Department Access UI loads/saves via `/api/users`. Auth is no longer stored in or read from `DepartmentDetails.payloadJson`; GET/POST department-details strip `userRecords` from response/store.
23. **Wave 4 (done):** Change-password UX in Settings > Profile Management with client+server validation. Added `POST /api/auth/change-password` (current password required) and password policy enforcement (8+ chars, uppercase, lowercase, number, special). Added admin reset-password route `POST /api/users/:id/reset-password` and Department Access reset action. Password policy is enforced on user create/update and self-service change-password.

**Exit criteria:**
- Cross-tenant login/session leakage is blocked.

---

## Now vs Later (Task 2 Reminder)

### Now (completed)
- Wave 3 + Wave 4 core auth/account scope is complete (tenant-scoped users, login hardening, password change/reset, password policy enforcement).
- Wave 6 domain routing and staging stability gate are complete.
- Wave 7 DEMO safety decision is complete: `demo` remains a persistent, fully editable sandbox (no automatic reset, no new restrictions in this phase).
- Wave 8 verification checklist is complete: tenant login/isolation checks, cross-tenant save separation checks, scheduler/personnel/Kelly validation, and lint/build + smoke checks in staging.

### Later (deferred hardening backlog)
- Complete staging and production verification of the new incident workflow configuration surface (`Admin Functions -> Department Details -> Incidents Setup`) and incident linkage behavior (`Incident #` sync between incident queue and NERIS form).
- Move incident table display preferences (column widths, order, visibility) from browser-local per-user storage to backend-persisted per-user preferences so settings follow users across devices/browsers.
- Replace prompt-based admin reset-password UX with an in-app modal/dialog flow.
- Add auth rate-limiting and/or temporary lockout on repeated failed login attempts.
- Add password-change/reset audit logging (who/when/target user) for security traceability.
- Deploy frontend staging on Render (keep local frontend for now while backend/domain setup is completed).
- Implement configurable tenant policy controls for demo-style tenants (for example, optional restricted mode flags per tenant) when business rules are finalized.

Use this section as the high-level backlog pointer. Track detailed deferred/future items in `docs/later-changes-backlog.md` going forward.

---

## Phase 5 — Tenant-Scoped APIs

21. Update all API read/write queries to include `tenant_id`.
22. Ensure writes stamp current `tenant_id`.
23. Remove shared/global tenant data reads where inappropriate.
24. **Phase 5 status (done):** Added tenant-scoped Schedule Assignments API (`GET/POST /api/schedule-assignments`) backed by `ScheduleAssignments` table. Scheduler now syncs assignments + overtime split through tenant-scoped API (with local cache fallback), replacing local-only persistence as the source of truth.

Primary routes to scope first:

- `/api/department-details`
- schedule assignment APIs
- personnel/settings APIs

**Exit criteria:**
- Crescent and Demo data are fully isolated by API behavior.

---

## NERIS Multi-Tenant Credentials (Critical Reminder)

Current `.env.server` NERIS values are global and useful for early/local testing, but production multi-tenant requires per-tenant credential storage.

### Keep global in env

- `NERIS_BASE_URL` (shared if same for all tenants)

### Move to tenant-scoped storage (DB)

- `nerisEntityId`
- `nerisDepartmentNerisId`
- `nerisClientId`
- `nerisClientSecret` (encrypt at rest)
- optional: `nerisGrantType`, `nerisTokenScope`, and user/password fields if needed by grant flow

### Implementation rule

- Resolve tenant by domain first.
- Load NERIS credentials for that tenant from DB.
- Use `.env.server` as fallback only in local/dev where tenant config is missing.
- Verification note: do not treat `GET /entity` as a canonical authorization list. For entity confirmation, use `GET /entity?neris_id=<id>` and/or `GET /entity/<id>` and check enrollment via `GET /account/enrollment/<client_id>`.

---

## Phase 6 — DNS + Domain Routing

24. Configure wildcard DNS:
    - `*.yourdomain.com` -> app host target
25. Configure SSL for wildcard/subdomains.
26. Verify:
    - `crescent.<domain>` resolves and loads
    - `demo.<domain>` resolves and loads
27. Use runbook: `docs/wave-6-domain-routing-runbook.md` for exact DNS/SSL/verification steps.

**Exit criteria:**
- Tenant URLs work via domain-based routing.

**Phase 6 status:** Done (staging DNS + SSL + tenant-domain routing verified, tenant-context endpoint validated per host, and frontend stability hardening gate passed on both staging tenant hosts).

---

## Phase 7 — DEMO Safety Controls

27. DEMO behavior (decided): **persistent sandbox** — editable, no automatic reset.
28. No demo reset script required.
29. Optionally hide sensitive/admin actions for DEMO users.

**Exit criteria:**
- DEMO remains safe and consistent for external walkthroughs.

**Phase 7 status:** Done (Option A): `demo` remains persistent and fully editable for sandbox/testing use, with no automatic reset and no new restrictions introduced in this phase.

---

## Phase 8 — Verification + Acceptance

30. Test Crescent login/data isolation.
31. Test Demo login/data isolation.
32. Verify save in one tenant does not affect the other.
33. Verify schedule/personnel/Kelly behavior in both tenants.
34. Run lint/build checks and smoke tests after deployment.

**Exit criteria:**
- Multi-tenant domain-based behavior is stable in staging/demo.

**Phase 8 status:** Done (user confirmed full Phase 8 checklist completion across staging tenant hosts, including tenant isolation and cross-tenant save separation validation).

---

## Suggested Build Order (Execution Sequence)

1. Phase 0 decisions
2. Phase 1 DB + Prisma
3. Phase 2 seed tenants
4. Phase 3 tenant middleware
5. Phase 4 auth binding
6. Phase 5 tenant-scoped APIs
7. Phase 6 DNS routing
8. Phase 7 DEMO controls
9. Phase 8 full validation

---

## Branch/Repo Strategy

- Keep one main product repo.
- Use feature branches for implementation work.
- Do not create one long-lived branch per department.
- Department-specific behavior should be tenant config/data driven.

---

## Phase 0 Checklist (Quick Start)

- [ ] Chosen domain name
- [ ] Chosen host stack (Render/Neon/etc.)
- [ ] Confirmed tenant subdomain naming
- [x] Confirmed DEMO behavior: persistent sandbox (no auto-reset)

