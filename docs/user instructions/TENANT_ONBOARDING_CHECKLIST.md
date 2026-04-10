# Tenant Onboarding Checklist (NERIS + Fire Ultimate)

Use this checklist each time you onboard a new department tenant.

**Related doc:** For **first-time production database setup** (new Neon project, migrations, seed, wiring Render), or for the exact steps to **add a tenant’s production domain** after seeding, see **`NEON_PRODUCTION_PROJECT_SETUP.md`** in this folder.

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

**How to create a new tenant (choose one):**

- **Option 1 – `tenant:create` (recommended for new tenants):** Creates tenant, **one** domain, DepartmentDetails shell, and admin user in one step. Run against the target DB (e.g. production). Use the **production** hostname so the live domain is set from the start:
  ```bash
  npm run tenant:create -- --slug <tenant-slug> --name "Department Name" --hostname <tenant>.fireultimate.app --status active --adminUsername admin --adminPassword <temp>
  ```
  To also allow staging, add the staging domain afterward (see “Add a domain for an existing tenant” below).

- **Option 2 – Seed:** The repo seed creates `cifpdil` and `demo` with **staging** domains only. It does **not** add `<tenant>.fireultimate.app`. After running seed, you must add the production domain manually (see below). See **NEON_PRODUCTION_PROJECT_SETUP.md** Step 5 for full detail.

**Add a domain for an existing tenant** (e.g. production hostname after seed, or staging after tenant:create):

- **SQL (Neon SQL Editor or any Postgres client):** Replace `<tenant-slug>` and `<hostname>` with the tenant slug and full hostname (e.g. `mytenant.fireultimate.app`).
  ```sql
  INSERT INTO "TenantDomain" ("id", "tenantId", "hostname", "isPrimary")
  SELECT
    'c' || substr(md5(random()::text), 1, 24),
    id,
    '<hostname>',
    false
  FROM "Tenant"
  WHERE slug = '<tenant-slug>';
  ```
  If you get “duplicate key” on `TenantDomain_hostname_key`, the domain is already added; no action needed.

- **Script (cifpdil production only):** For **cifpdil.fireultimate.app** only, you can run `node --env-file=.env.production scripts/add-production-domain.mjs`. For other tenants, use the SQL above.

**If this tenant has a dedicated Neon database** (separate from shared prod): Follow **NEON_PRODUCTION_PROJECT_SETUP.md** in full (new Neon project, migrations, seed or tenant:create, add domain, set Render `DATABASE_URL`), then continue this checklist from section C.

### B.2 Create tenant admin user
- [ ] Admin user exists for tenant (role `admin`).
- [ ] Temporary password delivered securely.
- [ ] Force/change password process confirmed.

(If you used `tenant:create` in B.1, the admin user is already created; otherwise create via seed, API, or DB.)

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
- [ ] **`CAD_INGEST_SECRET`** — Long random shared secret for **CAD email ingest**. Required when the API runs with **`NODE_ENV=production`** (typical on Render): without it, **`POST /api/cad/inbound-email` returns 503** and the Cloudflare Worker cannot store mail. **Not** tenant-specific in the database — one value per API deployment — but you need it for any tenant whose CAD address feeds that API.

Notes:
- Keep secrets only in Render env, not in repo files.
- Redeploy/restart after env changes.

**Staging API (e.g. `*.staging.fireultimate.app`):** If Render sets **`NODE_ENV=production`** for staging (common), set **`CAD_INGEST_SECRET`** on the **staging** service too, and set the **same** value on **cad-email-ingest-worker** (Cloudflare Secret) while **`CAD_INGEST_API_URL`** points at staging. See **`docs/procedures/EMAIL_AND_CAD_SETUP.md`**.

### C.1 Step-by-step: `CAD_INGEST_SECRET` (same value on Render + Cloudflare Worker)

Do this for **each** API deployment that uses CAD ingest (usually **staging** and **production** are separate Render services or the same service with one URL—match the Worker’s **`CAD_INGEST_API_URL`** to the service you are configuring).

#### Part 1 — Generate a secret (once per environment pairing)

1. On your computer, open a terminal **or** use a password manager to create a long random string (at least 32 characters).
2. Example (macOS/Linux terminal):  
   `openssl rand -hex 32`  
   Copy the output and keep it in a secure note until pasted into Render and Cloudflare (same value in both places).

#### Part 2 — Render (FireUltimate API)

1. In your browser, go to **[https://dashboard.render.com](https://dashboard.render.com)** and sign in.
2. Open your **Dashboard** and select the **Web Service** that runs the FireUltimate API (e.g. `fireultimate-api-staging` or your production API name).
3. In the left sidebar for that service, click **Environment**.
4. Under **Environment Variables**, click **Add Environment Variable** (or **Edit** if you are replacing an existing key).
5. **Key:** `CAD_INGEST_SECRET` (exact spelling, all caps with underscores).
6. **Value:** paste the secret from Part 1.
7. Click **Save Changes**. Render will typically **redeploy** the service automatically; wait until the deploy shows **Live** (or trigger **Manual Deploy** if your team does that after env changes).

**Check `NODE_ENV` (why this matters):** On the same **Environment** page, see whether **`NODE_ENV`** is set to **`production`**. If it is (common on Render), the API **requires** `CAD_INGEST_SECRET` for **`POST /api/cad/inbound-email`**. If you omit it, that endpoint returns **503** until you add the variable.

#### Part 3 — Cloudflare Worker (`cad-email-ingest-worker`)

1. Go to **[https://dash.cloudflare.com](https://dash.cloudflare.com)** and sign in.
2. In the left sidebar, click **Workers & Pages** (or **Compute** → **Workers & Pages**, depending on Cloudflare’s UI).
3. Click the Worker named **`cad-email-ingest-worker`** (or the name you deployed from `cad-email-ingest-worker/` in this repo).
4. Open the **Settings** tab (top of the Worker detail page).
5. Find **Variables and Secrets** (sometimes under **Settings** → scroll to **Variables and Secrets**).
6. Under **Secrets**, click **Add** / **Add variable** and choose **Secret** (encrypted) when prompted:
   - **Variable name:** `CAD_INGEST_SECRET`
   - **Value:** paste the **same** secret you set on Render in Part 2.
7. Save. (No redeploy is always required for Workers after secret change, but wait a minute if Cloudflare shows a propagation message.)

8. Still on **Variables and Secrets**, confirm a **plain** (non-secret) variable exists:
   - **Name:** `CAD_INGEST_API_URL`
   - **Value:** must match the API you configured on Render, **no trailing slash**, for example:
     - Staging: `https://<tenant-slug>.staging.fireultimate.app/api/cad/inbound-email`
     - Production: `https://<tenant-slug>.fireultimate.app/api/cad/inbound-email`  
   Replace `<tenant-slug>` with the tenant’s slug (e.g. `cifpdil`).

#### Part 4 — Quick verification (optional but recommended)

1. From a terminal (replace URL and secret):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://<tenant-slug>.staging.fireultimate.app/api/cad/inbound-email" \
     -H "Content-Type: application/json" \
     -H "X-CAD-Ingest-Secret: YOUR_SECRET_HERE" \
     -d '{"from":"test@test.com","to":"<tenant-slug>@cad.fireultimate.app","raw":"","headers":{}}'
   ```
2. Expect **`200`**. **`503`** → API missing `CAD_INGEST_SECRET` on Render or not redeployed. **`401`** → Worker or curl header does not match the API value.

Full CAD routing (DNS, Email Routing, migrations) remains in **`docs/procedures/EMAIL_AND_CAD_SETUP.md`**.

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

## Personnel Schedule (optional — train after core setup)

- [ ] **Timed segments:** In the day-block modal, the slot checkbox enables split timed coverage (hover for tooltip; explained in training, not a separate “Segment” label).
- [ ] **Per-segment OT:** For hire-back / off-shift fills, check **OT** on that segment; the dropdown lists roster-eligible personnel (requires **name + shift** in Scheduler Personnel).
- [ ] **Greyed names:** If someone is already on **another segment of the same slot**, they appear **disabled** in the shift list; enable **OT** on this segment to use the full roster for that slice.
- [ ] Reference: `docs/plans/SCHEDULE_OVERTIME_IMPLEMENTATION_SPEC.md`.

---

## G) Security + Operations Closeout

- [ ] Confirm no secrets in repo (`.env.server` is gitignored).
- [ ] Rotate temporary admin credentials after first login.
- [ ] Document onboarding completion in handoff/session notes.
- [ ] Add tenant to monitoring/watchlist.

---

## I) CAD dispatch email (when this tenant receives CAD by email)

Use this when dispatch will send mail to **`<tenant-slug>@cad.fireultimate.app`** or **`<tenant-slug>@fireultimate.app`** (see **`docs/procedures/EMAIL_AND_CAD_SETUP.md`**). The **tenant slug** in the address must match the **`Tenant.slug`** row so ingest resolves **`tenantId`**.

- [ ] **Secrets + API URL:** Complete **§C.1** above (Render `CAD_INGEST_SECRET` + Cloudflare Worker **Secret** `CAD_INGEST_SECRET` + Worker **`CAD_INGEST_API_URL`** pointing at this tenant’s API host).
- [ ] **Email Routing (Cloudflare):** Route the CAD address to the Worker:
  1. **[https://dash.cloudflare.com](https://dash.cloudflare.com)** → select the zone **`fireultimate.app`** (or **`cad.fireultimate.app`** if you use a separate zone for the cad subdomain—see **`EMAIL_AND_CAD_SETUP.md`**).
  2. Left sidebar → **Email** → **Email Routing** (sometimes **Email** → **Routing rules**).
  3. Open **Custom addresses** (or **Addresses** / **Routing** depending on UI).
  4. Create or edit the address whose **local part** equals **`<tenant-slug>`** (e.g. `cifpdil`), so the full address is **`cifpdil@cad.fireultimate.app`** or **`cifpdil@fireultimate.app`** as designed for your tenant.
  5. Set the action to **Send to a Worker** (or **Worker**) and choose **`cad-email-ingest-worker`**. Save.
- [ ] **Database:** `CadEmailIngest` migration applied on the **same** database as this API (see **`EMAIL_AND_CAD_SETUP.md`** §B6).
- [ ] **Database migration (CAD parsing / allowlist storage — Batch C):** See **§I.2** below (staging first, then production). Until this runs on a given database, **`GET/PATCH /api/cad/parsing-config`** and **`/api/cad/allowlist`** will error for that environment.

### I.2 Run Batch C migration: **staging first**, then **production**

**Project root:** The folder on your computer that contains **`package.json`** and a **`prisma`** folder. Example: `FireUltimate-V1.0.0.0` (name or path may differ). Check in Terminal: `ls package.json prisma` — both files must exist in that directory.

---

#### Part A — Staging database (do this first)

1. Open **[https://dashboard.render.com](https://dashboard.render.com)** and sign in.
2. Open the **Web Service** that runs your **staging** API (the one tied to **`*.staging.fireultimate.app`** or your staging hostname).
3. Click **Environment** in the left sidebar.
4. Find **`DATABASE_URL`**. Reveal/copy the **full** value (it starts with `postgresql://`). This is the **staging** Postgres connection string (often a Neon URL).
5. On your Mac, open **Terminal**.
6. Go to the **project root**, for example:
   ```bash
   cd ~/CursorProjects/FireUltimate-V1.0.0.0
   ```
   Use your real path if different. Confirm:
   ```bash
   ls package.json prisma
   ```
   You should see both listed.
7. In your editor, open **`.env.server`** in that same folder (copy from **`.env.server.example`** if you do not have it yet).
8. Set this line to the **staging** URL you copied (one line, no spaces around `=`):
   ```bash
   DATABASE_URL=postgresql://...
   ```
   Save. **Do not commit** `.env.server` to git.
9. Run the migration **from the project root**:
   ```bash
   node --env-file=.env.server -e "require('child_process').execSync('npx prisma migrate deploy', {stdio:'inherit', env: process.env})"
   ```
10. In the output, confirm you see **`20260409140000_add_cad_parsing_settings_and_allowlist`** applied (or “already applied”) and **“All migrations have been successfully applied.”**
11. **Redeploy** your **staging** service on Render if the API code with Batch C is not already live (so the running app matches the updated database).

---

#### Part B — Production database (after staging is done)

1. In **Render**, open the **Web Service** for **production** (the one that serves **`cifpdil.fireultimate.app`** or your live hostname — **not** the staging service).
2. **Environment** → copy **`DATABASE_URL`** for **production**. It is usually **different** from staging (different Neon branch or project).
3. Edit **`.env.server`** again. Replace the **`DATABASE_URL=`** line with the **production** connection string only. Save.
4. In Terminal, **same project root**, run the **exact same command**:
   ```bash
   node --env-file=.env.server -e "require('child_process').execSync('npx prisma migrate deploy', {stdio:'inherit', env: process.env})"
   ```
5. Confirm success in the terminal again.
6. **Redeploy** the **production** Render service if needed so the latest API code is running.

---

#### After both

- Optionally change **`.env.server`** back to **staging** `DATABASE_URL` for day-to-day local work, or keep a private note of which database you pointed at last.
- Never paste **`DATABASE_URL`** or secrets into public chat or commit them to the repo.
- [ ] **Smoke test (email path):** Send a real test email to the CAD address from your inbox.
  - **Render:** Service → **Logs** → look for **`POST /api/cad/inbound-email`** with status **200** (not **503** / **401**).
  - **App:** Log in as admin → **Admin Functions** → **Dispatch Parsing Settings** (parent) → sidebar **Raw Email** → confirm a new row appears.
  - **Optional DB check:** Neon **SQL Editor** → `SELECT id, "toAddress", "fromAddress", "createdAt" FROM "CadEmailIngest" ORDER BY "createdAt" DESC LIMIT 5;`

**Note (allowlist):** After **Batch D**, if the tenant has **at least one enabled** **`CadEmailAllowlistEntry`**, only **`From`** addresses matching a pattern are stored; others get **HTTP 200** with **`ok: false`** (no DB row). **No enabled rows** = all senders allowed. Configure allowlist via **`PATCH /api/cad/allowlist`** (admin UI in a later batch) or direct API. See **`docs/procedures/EMAIL_AND_CAD_SETUP.md`** §B6.5.

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

