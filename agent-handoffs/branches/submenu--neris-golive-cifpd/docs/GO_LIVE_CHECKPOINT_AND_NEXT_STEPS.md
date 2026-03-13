# Go-Live Checkpoint and Next Steps (Pick Up Here)

Last updated: 2026-03-11
Branch: `submenu/neris-golive-cifpd`

Use this file as the single resume point if session ends.

---

## 0) Render: DATABASE_URL for production vs staging (from the beginning)

**Should DATABASE_URL be the same for prod and staging?**
- **No, usually not.** Best practice is:
  - **Production** (e.g. service `fireultimate-prod-api`): use a **production** database. All live data (tenants, incidents, department details, users) lives here.
  - **Staging** (e.g. service `fireultimate-api-staging` or similar): use a **staging** database (or a copy/branch of the DB). So staging tests and seed data don’t change production.
- **Same DB for both** is possible (tenant and hostname separate staging vs prod traffic), but then staging and prod share the same data; one mistake or seed can affect the other. Prefer **separate** DATABASE_URL per environment.

**Where it’s set:**
- In **Render**, each **service** has its own **Environment** (Environment tab for that service).
- **fireultimate-prod-api** → set **DATABASE_URL** (and NERIS_*, etc.) to the **production** Postgres connection string.
- Your **staging** service → set **DATABASE_URL** to the **staging** Postgres connection string (e.g. a different Neon DB or staging project).

**How to confirm you have the correct DATABASE_URL:**

1. **In Render (no secrets in chat):**  
   Open the service → **Environment**. Confirm DATABASE_URL is set. You can’t see the full value (it’s masked), but you can see that it exists and compare **which** database it points to if your provider shows a short label (e.g. Neon project name or host).

2. **By behavior (safest check):**  
   - **Production:** After deploy, log in at **cifpdil.fireultimate.app**. If you see your real department details, incidents, and tenants (not demo sample data), the prod app is talking to the right DB.  
   - **Staging:** Use **cifpdil.staging.fireultimate.app**; that service should use the staging DATABASE_URL. If you run seeds or tests there, production should be unchanged.

3. **Optional: connect from your machine (read-only):**  
   If you have a **production** connection string only in a safe place (e.g. Render env copy in a local file that’s gitignored), you can run a read-only check locally, e.g.:  
   `npx prisma db execute --url "$DATABASE_URL" --stdin <<< "SELECT 1"`  
   or use a GUI (Neon dashboard, TablePlus, etc.) with the **same** URL that’s in Render for that service. If that URL connects and shows the expected database name/host, it matches what the service uses.

**Summary:** Production service = production DATABASE_URL; staging service = staging DATABASE_URL. Confirm by (1) checking Render Environment for that service and (2) verifying the app on that host shows the data you expect for that environment.

**If you only have a staging DB in Neon:** Create a separate production project and wire it to Render using the step-by-step guide: **`NEON_PRODUCTION_PROJECT_SETUP.md`** in this folder.

---

## 1) Current verified status

### Staging (`fireultimate-api-staging`)
- `GET /api/tenant/context` -> OK (`cifpdil` resolved).
- `GET /api/neris/health` -> OK, `baseUrl=https://api-test.neris.fsri.org/v1`, `hasClientCredentials=true`, `hasTenantEntityId=false`.
- `GET /api/neris/debug/entity-check?nerisId=FD17075450` -> OK for:
  - `/entity?neris_id=FD17075450`
  - `/entity/FD17075450`
- `/account/enrollment/{client_id}` may return 403 in test env; this is not currently blocking when entity checks pass.

### Production (`main` deploy path)
- `GET /api/tenant/context` -> OK.
- `GET /api/neris/health` -> OK, `baseUrl=https://api.neris.fsri.org/v1`.
- `GET /api/neris/debug/entity-check?...` -> **missing route** (`Cannot GET`) because production is not yet on branch changes.

## 2) Critical go-live blocker (mandatory)

Incident Detail page must have editable incident input boxes for end users.

Current state:
- Create Incident row creation works.
- Queue row linkage into NERIS form path is fixed in branch code.
- Incident Detail page remains mostly display-only and needs editable inputs.

## 3) Exact next sequence (do in order)

**Staging browser tests (2.1–2.5):** Passed 2026-03-12. See STAGING_TEST_STEPS_BEGINNER.md.

**Order:** Get incident data fully on the server and working **before** PR to main, so the department has a complete, functional system.

1. ~~Confirm with user the exact editable field set and save behavior for Incident Detail page.~~ (User confirmed 2.2 pass.)
2. ~~Validate staging UX~~ — Done (2.1–2.5 pass).
3. ~~**Run staging validate/export proof**~~ — **Passed 2026-03-13.** Export returned 201 Created; NERIS `neris_id`: `FD17075450|none|1771420482`, status SUBMITTED. `incident_number` sanitization (Test-_Export) accepted.
4. ~~**Complete Step 4 (Incident API in frontend)**~~ — **Done.** App loads list from GET /api/incidents on login; create/update/delete use POST/PATCH/DELETE; localStorage used as cache after API success.
5. **Then:** Open PR branch `submenu/neris-golive-cifpd` → `main` → merge and deploy production.
6. Re-run production endpoint checks (see §4 below).
7. Perform first controlled production export when ready.

## 4) Commands for quick re-check

```bash
curl -sS "https://cifpdil.staging.fireultimate.app/api/tenant/context"
curl -sS "https://cifpdil.staging.fireultimate.app/api/neris/health"
curl -sS "https://cifpdil.staging.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450"
curl -sS "https://cifpdil.fireultimate.app/api/tenant/context"
curl -sS "https://cifpdil.fireultimate.app/api/neris/health"
curl -sS "https://cifpdil.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450"
```

## 5) NERIS incident_number (internal_id) format

NERIS returns **422 "Invalid internal_id format for incident"** if `base.incident_number` or `dispatch.incident_number` contain spaces or other disallowed characters. The proxy now **sanitizes** these values before sending: spaces → underscore, and only `A–Z a–z 0–9 _ -` are kept. So e.g. "Test- Export" is sent as "Test-_Export". Users can still type anything in the form; the payload sent to NERIS is normalized.

---

## 6) CAD dispatch via email (after incidents on server)

**Order:** Get incidents fully on the server (Step 4) and PR to main first; then CAD email ingest.  
**Guide:** See **CAD_EMAIL_INGEST_SETUP_GUIDE.md** in this folder — step-by-step: (1) set up email address and give to dispatch, (2) server monitors that inbox (IMAP or webhook), (3) you send test email from dispatch, (4) we parse and auto-fill incident fields.

---

## 7) NERIS credentials: which key for which environment

**Entity ID (same for both):** `FD17075450` — use for **NERIS_ENTITY_ID** and **NERIS_DEPARTMENT_NERIS_ID** in both test and production.

**Test (staging / api-test):**
- **NERIS_BASE_URL** = `https://api-test.neris.fsri.org/v1`
- **NERIS_CLIENT_ID** = `1b6dbb74-68c6-4ae2-9625-bb2e3bbea9f1`
- **NERIS_CLIENT_SECRET** = (your test client secret from NERIS)

**Production:**
- **NERIS_BASE_URL** = `https://api.neris.fsri.org/v1`
- **NERIS_CLIENT_ID** = **`3f104b60-f7cf-437e-b79c-868fe6489f31`** ← use this Client ID for production.
- **NERIS_CLIENT_SECRET** = (your **production** client secret for the above Client ID)

**Where to set NERIS_CLIENT_SECRET (and other NERIS vars):**
- **No frontend UI** — Correct; secrets stay server-side only and are never in the app UI.
- **Local / `npm run proxy`:** In **`.env.server`** in the project root (proxy loads it via `--env-file=.env.server`). Use **test** values there so local runs don’t touch production NERIS.
- **Production (e.g. Render):** In your **hosting platform’s environment** (e.g. Render → your service → Environment). Set NERIS_BASE_URL, NERIS_CLIENT_ID, NERIS_CLIENT_SECRET, NERIS_ENTITY_ID for the **production** deploy. The branch does not control env — the production **service** has its own env in Render. Production credentials go in Render’s env; local `.env.server` does not affect production.

NERIS confirmed: Client ID `3f104b60-f7cf-437e-b79c-868fe6489f31` is correctly authorized for production API access to entity FD17075450; no pending action. There is no “accessible entities list” endpoint; the closest is **GET /account/enrollment/{client_id}**. To see your own entity, use **GET /entity?neris_id=FD17075450** or **GET /entity/FD17075450**. Our `/api/neris/debug/entity-check` already uses those plus enrollment; **GET /entity** without params is a directory listing (used in debug/entities only).

### Verify NERIS before first production export (terminal or browser)

Run these **before** exporting a live incident so auth and entity access are correct.

**Production (after deploy from main):**

| Check | Terminal (curl) | Browser URL |
|-------|------------------|-------------|
| Tenant | `curl -sS "https://cifpdil.fireultimate.app/api/tenant/context"` | https://cifpdil.fireultimate.app/api/tenant/context |
| NERIS health | `curl -sS "https://cifpdil.fireultimate.app/api/neris/health"` | https://cifpdil.fireultimate.app/api/neris/health |
| Entity + enrollment | `curl -sS "https://cifpdil.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450"` | https://cifpdil.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450 |

**Success looks like:**
- **tenant/context:** `{"ok":true,"tenant":{...}}` with your tenant (e.g. cifpdil).
- **neris/health:** `{"ok":true,...}` with `"baseUrl":"https://api.neris.fsri.org/v1"` and `hasClientCredentials: true`. If `hasClientCredentials: false`, NERIS_CLIENT_ID or NERIS_CLIENT_SECRET is missing in production env.
- **entity-check:** `{"ok":true,"submittedEntityId":"FD17075450","summary":{"entityFoundViaQuery":true,"entityFoundViaPath":true,...},...}`. Both entityFoundViaQuery and entityFoundViaPath true means the token can see entity FD17075450. Fix production env and re-run if any check fails.

---

## 8) Production troubleshooting: Incidents Setup not visible / sample incidents in Incidents tab

**Incidents Setup not visible on Department Details**
- Incidents Setup is on the **same** page as Department Details: **Admin Functions → Department Details** (path `/admin-functions/department-details`). It appears **below** the "Department Details" cards and the "Incident Audit Log" panel. **Scroll down** on that page to see the **Incidents Setup** heading and the field cards (Incident Type, Priority, Still District, etc.).
- If you are on **Scheduler Settings** or **Personnel Management** (different submenu links under Admin), those use the same page but a different mode and do **not** show Incidents Setup. Use the **Department Details** link in the sidebar.
- If you still don’t see it after scrolling, production may be on an older deploy. Ensure the branch that includes Incidents Setup (and the Incident API) is merged to `main` and that production has been **redeployed** from that commit.

**Sample incidents showing in Incidents tab on production**
- The app shows **sample (demo) incidents** when it considers the current tenant to be the **demo** tenant. That happens when either (1) the browser hostname contains `"demo"`, or (2) **GET /api/tenant/context** returns a tenant whose slug contains `"demo"`.
- **Check:** Open **https://cifpdil.fireultimate.app/api/tenant/context** in the browser (or run `curl -sS "https://cifpdil.fireultimate.app/api/tenant/context"`). The response should include `"tenant":{"slug":"cifpdil",...}`. If you see `"slug":"demo"` instead, the server is resolving the request to the **demo** tenant, so the Incidents list will show sample data and Incidents Setup may not match cifpdil.
- **Fix:** Ensure the **production** database has a **TenantDomain** row mapping **cifpdil.fireultimate.app** to the **cifpdil** tenant (not demo). The seed only adds staging domains (`cifpdil.staging.fireultimate.app`, `demo.staging.fireultimate.app`). For production, add the production domain, e.g. run once (with your production DB and admin key):  
  `POST /api/admin/tenants/<cifpdil-tenant-id>/domains` with body `{"hostname":"cifpdil.fireultimate.app","isPrimary":true}` (or insert into TenantDomain in the production DB). Then restart or wait for the next request so tenant resolution uses the new domain.

---

## 9) Notes to avoid confusion

- `cifpdil` is your tenant slug (internal app naming).
- **NERIS_CLIENT_ID** is assigned by NERIS per environment; test and production have different Client IDs (see §7).
- Keep staging on `api-test` as default safety path.
- Production route availability follows `main` deployment, not branch-only commits.
