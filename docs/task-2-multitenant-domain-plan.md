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
    reset nightly    


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

**Exit criteria:**
- Cross-tenant login/session leakage is blocked.

---

## Phase 5 — Tenant-Scoped APIs

21. Update all API read/write queries to include `tenant_id`.
22. Ensure writes stamp current `tenant_id`.
23. Remove shared/global tenant data reads where inappropriate.

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

---

## Phase 6 — DNS + Domain Routing

24. Configure wildcard DNS:
    - `*.yourdomain.com` -> app host target
25. Configure SSL for wildcard/subdomains.
26. Verify:
    - `crescent.<domain>` resolves and loads
    - `demo.<domain>` resolves and loads

**Exit criteria:**
- Tenant URLs work via domain-based routing.

---

## Phase 7 — DEMO Safety Controls

27. Choose DEMO behavior:
    - read-only, or
    - editable with nightly reset
28. Add demo reset script (if editable).
29. Optionally hide sensitive/admin actions for DEMO users.

**Exit criteria:**
- DEMO remains safe and consistent for external walkthroughs.

---

## Phase 8 — Verification + Acceptance

30. Test Crescent login/data isolation.
31. Test Demo login/data isolation.
32. Verify save in one tenant does not affect the other.
33. Verify schedule/personnel/Kelly behavior in both tenants.
34. Run lint/build checks and smoke tests after deployment.

**Exit criteria:**
- Multi-tenant domain-based behavior is stable in staging/demo.

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
- [ ] Confirmed DEMO behavior (read-only vs reset)

