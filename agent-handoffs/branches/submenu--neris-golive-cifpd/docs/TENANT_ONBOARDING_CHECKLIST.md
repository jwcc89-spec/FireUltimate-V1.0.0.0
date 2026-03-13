# Tenant Onboarding Checklist (NERIS + Fire Ultimate)

Use this checklist each time you onboard a new department tenant.

---

## A) Intake from Department / NERIS

### A.1 What the department gives you
- [ ] Department legal/official name.
- [ ] Desired tenant slug (lowercase, no spaces, e.g. `cifpdil`, `watsekafd`).
- [ ] Primary contact email + phone.
- [ ] Admin username to create in Fire Ultimate.

### A.2 What you provide to NERIS
- [ ] `NERIS_CLIENT_ID` (if NERIS requests it during enrollment/association flow).
- [ ] Any required department profile info NERIS asks for.

### A.3 What NERIS provides back
- [ ] Department/entity identifier (`NERIS_ENTITY_ID`, format like `FD########`).
- [ ] Confirmation of production access/enrollment for that entity.
- [ ] (If applicable) department NERIS ID used in report field mapping.

Important:
- **Never** put `NERIS_CLIENT_SECRET` in frontend/UI.
- `NERIS_CLIENT_SECRET` stays backend-only (Render environment variable).

---

## B) Fire Ultimate Tenant Setup

### B.1 Create or verify tenant in DB
- [ ] Tenant exists with slug `<tenant-slug>`.
- [ ] Tenant status is `active` for live usage.
- [ ] Tenant has `TenantDomain` entries needed for environment(s):
  - [ ] `<tenant>.staging.fireultimate.app` (optional for staging)
  - [ ] `<tenant>.fireultimate.app` (required for live)

### B.2 Create tenant admin user
- [ ] Admin user exists for tenant (role `admin`).
- [ ] Temporary password delivered securely.
- [ ] Force/change password process confirmed.

---

## C) Render Production Environment Variables

Set on production API service (example `fireultimate-prod-api`):

- [ ] `DATABASE_URL` (production DB)
- [ ] `PLATFORM_ADMIN_KEY`
- [ ] `NERIS_BASE_URL=https://api.neris.fsri.org/v1`
- [ ] `NERIS_GRANT_TYPE=client_credentials`
- [ ] `NERIS_CLIENT_ID=<prod client id>`
- [ ] `NERIS_CLIENT_SECRET=<prod client secret>`
- [ ] `NERIS_ENTITY_ID=<tenant or default prod entity id>` (current architecture fallback)
- [ ] `NERIS_DEPARTMENT_NERIS_ID=<optional fallback>`

Notes:
- Keep secrets only in Render env, not in repo files.
- Redeploy/restart after env changes.

---

## D) DNS + Domain Routing

### D.1 Render custom domain
- [ ] Add custom domain `<tenant>.fireultimate.app` to production API service.

### D.2 Cloudflare DNS record
- [ ] Add CNAME:
  - Type: `CNAME`
  - Name: `<tenant>`
  - Target: Render-provided hostname
  - Proxy status: `DNS only` initially
  - TTL: Auto

### D.3 SSL verification
- [ ] Render domain status shows verified/active.
- [ ] HTTPS opens without cert errors.

---

## E) App-Level NERIS Configuration

### E.1 Tenant context check
- [ ] `GET https://<tenant>.fireultimate.app/api/tenant/context` returns `tenant.slug=<tenant-slug>`.

### E.2 NERIS health checks
- [ ] `GET https://<tenant>.fireultimate.app/api/neris/health` returns ok.
- [ ] `GET https://<tenant>.fireultimate.app/api/neris/debug/entity-check?nerisId=<FD########>` confirms entity lookup via NERIS `entity` endpoints.
- [ ] `GET https://<tenant>.fireultimate.app/api/neris/debug/entities` reviewed as informational directory output only.

### E.3 Department NERIS field setup
- [ ] Admin Customization/Department config has correct Vendor/Department code.
- [ ] NERIS form auto-fills Department NERIS ID correctly (or fallback env value used).

---

## F) First Submission Validation

### F.1 Pre-submit
- [ ] Login works for tenant admin.
- [ ] Required NERIS fields are filled in report form.
- [ ] Incident type-specific required fields pass validation.

### F.2 First export
- [ ] Submit one controlled test incident from Reporting -> NERIS.
- [ ] Confirm success response (NERIS incident ID / accepted status).
- [ ] Capture timestamp + incident reference for audit notes.

### F.3 If failed
- [ ] Save exact API response body.
- [ ] Save Render log lines at failure timestamp.
- [ ] Verify base URL/credentials/environment mismatch (test vs prod).

---

## G) Security + Operations Closeout

- [ ] Confirm no secrets in repo (`.env.server` is gitignored).
- [ ] Rotate temporary admin credentials after first login.
- [ ] Document onboarding completion in handoff/session notes.
- [ ] Add tenant to monitoring/watchlist.

---

## H) Future Architecture Upgrade (track, not required now)

Current model uses global NERIS credentials per deployment.
Target model for scale:

- [Later] Store per-tenant NERIS config in DB:
  - `nerisEntityId`
  - `nerisDepartmentNerisId`
  - `nerisClientId`
  - `nerisClientSecret` (encrypted)
- [Later] Resolve tenant by domain and load NERIS config server-side per request.
- [Later] Keep `NERIS_BASE_URL` global by environment.

