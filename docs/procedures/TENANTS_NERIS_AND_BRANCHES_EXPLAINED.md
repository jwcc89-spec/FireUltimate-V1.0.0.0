# Tenants, NERIS Credentials, and Branches — Plain-Language Guide

This doc is for anyone new to coding who wants to understand: (1) where NERIS Entity ID lives today and where it will live per tenant, (2) how testing on the demo account works with `npm run proxy` and the api-test NERIS URL, and (3) how branches, tenants, and environments fit together so things stay organized.

---

## 1. Where is NERIS_ENTITY_ID stored? (Today vs. Future)

### Today (current behavior)

- **All NERIS-related values live in one file:** `.env.server` (on the machine or server where the proxy runs).
- That file is **global**: there is only one `NERIS_ENTITY_ID`, one `NERIS_CLIENT_ID`, one `NERIS_CLIENT_SECRET`, and one `NERIS_BASE_URL` for the **entire** proxy process.
- So no matter which tenant (demo, cifpdil, etc.) is using the app, the proxy uses that **same** set of values from `.env.server`.
- The **frontend** can send a different Entity ID per request (e.g. from Admin Customization / Vendor–Department code). The proxy uses that if provided; otherwise it falls back to `NERIS_ENTITY_ID` from `.env.server`. But the **OAuth credentials** (Client ID/Secret) and **base URL** used to talk to NERIS are still the single set from `.env.server`.

So today: **NERIS_ENTITY_ID is not stored “per tenant” anywhere.** It’s either:

- In `.env.server` as the default, or  
- Sent per request by the frontend (e.g. from the department’s Customization/Vendor code).

### Future (per-tenant NERIS credentials)

The plan (see `docs/task-2-multitenant-domain-plan.md`, “NERIS Multi-Tenant Credentials”) is:

- **Keep in env (global):**  
  - `NERIS_BASE_URL` — same for all tenants (e.g. one production URL).
- **Move to the database, per tenant:**
  - `nerisEntityId`
  - `nerisDepartmentNerisId`
  - `nerisClientId`
  - `nerisClientSecret` (stored encrypted)

So **NERIS_ENTITY_ID will eventually be stored per tenant in the DB**, not in `.env.server`. Typical approach:

1. **Resolve tenant** from the request (e.g. from the hostname: `demo.staging.fireultimate.app` → tenant `demo`).
2. **Load that tenant’s NERIS settings** from the database (entity ID, department NERIS ID, client ID, client secret).
3. **Use those values** for that request (and keep `NERIS_BASE_URL` from env).

That work is not implemented yet. For now, everything still comes from `.env.server` (and optional entity ID from the request).

---

## 2. How does testing on the demo account work with `npm run proxy` and api-test?

### One proxy, one NERIS “environment”

- When you run **`npm run proxy`**, a **single** server process starts.
- That process reads **one** `.env.server` file and uses **one** `NERIS_BASE_URL` (and one set of Client ID/Secret, etc.).
- So for the **whole time that proxy is running**, every NERIS request (from any tenant) uses that same URL and same OAuth credentials.

### Typical “demo” testing setup

- **Goal:** Test the app with the **NERIS test API** (api-test), using the **demo** tenant.
- **Setup:**
  1. In `.env.server` set:
     - `NERIS_BASE_URL=https://api-test.neris.fsri.org/v1`
     - Plus the **test** NERIS credentials (Entity ID, Client ID, Client Secret) that NERIS gave you for testing.
  2. Run **`npm run proxy`** (and in another terminal **`npm run dev`** for the frontend).
  3. Open the app at **`http://localhost:...`** (or your usual dev URL). The app resolves to the **demo** tenant (localhost is treated as demo).
  4. Log in as the demo user and use **Reporting → NERIS** to fill and export a report.

**What happens:**

- The browser talks to your **local proxy**.
- The proxy uses **only** the values from `.env.server`: api-test URL and the test credentials.
- So “testing on the demo account” here means: **you are the demo tenant**, and **the only NERIS environment that proxy knows about is api-test**. Every export from that running proxy goes to api-test, no matter which tenant the frontend thinks it is (until per-tenant credentials exist).

### Keeping demo (test) and production separate

- **Option A — Same machine, different runs:**  
  - For **demo/test:** Run proxy with `.env.server` pointing at api-test and test credentials.  
  - For **production:** Don’t use that same proxy for live data; use a **separate** deployment (e.g. Render) with a **different** env that has `NERIS_BASE_URL=https://api.neris.fsri.org/v1` and **production** credentials.
- **Option B — Two env files (advanced):**  
  - e.g. `.env.server.test` and `.env.server.prod`, and you (or your deploy) choose which file to load when starting the proxy. The app doesn’t do this by default; you’d have to wire it (e.g. different start script or deploy config).

So: **demo account testing with api-test = one proxy + one .env.server with api-test URL and test credentials.** The “demo” part is which tenant you’re logged in as in the app; the “api-test” part is fixed by that single proxy config.

---

## 3. Branches, tenants, and environments — how to keep things organized

### Branches (Git)

- A **branch** is a line of code changes (e.g. `submenu/neris-golive-cifpd`, `submenu/neris-all`, `submenu/departmentdetails-ui`).
- **Use:** Different branches for different **features or goals** (e.g. “NERIS go-live for cifpdil” on one branch, “NERIS form improvements” on another, “department details UI” on another).
- **Rule of thumb:** Work on **one branch at a time** for a given task. Don’t mix branches in your head for one deployment.

### Tenants (customers / agencies)

- A **tenant** is one **customer or agency** in the app (e.g. **demo**, **cifpdil**).
- Each tenant has its own **data** (users, department details, schedule, etc.) and is identified by **hostname** (e.g. `demo.staging.fireultimate.app`, `cifpdil.fireultimate.app`).
- **Use:** Tenants separate **who** is using the app. Demo = sandbox; cifpdil = real department; later you might add more departments as more tenants.

### Environments (where the app runs)

- **Environment** = **where** the app (and proxy) run and **which** config they use:
  - **Local:** Your computer; `npm run proxy` + `npm run dev`; `.env.server` on your machine (e.g. api-test).
  - **Staging:** Shared test server (e.g. Render); often api-test NERIS and staging DB; hostnames like `*.staging.fireultimate.app`.
  - **Production:** Live server; production NERIS URL and credentials; hostnames like `cifpdil.fireultimate.app`.

### How they relate (simple picture)

- **One deployment** (e.g. “staging” or “production”) = **one running proxy** = **one** `NERIS_BASE_URL` and **one** set of NERIS credentials from env (until per-tenant DB exists).
- **Many tenants** can use that **same** deployment (different hostnames → different tenants, same proxy).
- **Branches** are how you develop **code**; when you deploy, you deploy **one branch** (e.g. `main` or `submenu/neris-golive-cifpd`) to a given environment.

So:

- **Branch** = which version of the code (e.g. go-live work).
- **Tenant** = which customer/agency (demo vs cifpdil).
- **Environment** = where it runs and which NERIS URL/creds that run uses (local api-test vs production).

You keep things separated by:

- Using **one branch** per line of work.
- Using **one .env.server** (or env config) per **running proxy** so that each “environment” (e.g. local test vs prod) has a clear NERIS URL and credential set.
- Relying on **hostname → tenant** so that the same deployment can serve multiple tenants without mixing their data (and in the future, per-tenant NERIS credentials from the DB will separate NERIS identity per tenant as well).

---

## 4. Quick reference

| Concept            | What it is                          | Where it “lives” or how it’s chosen        |
|--------------------|-------------------------------------|--------------------------------------------|
| NERIS_ENTITY_ID    | NERIS entity for the department     | **Today:** `.env.server` or from request. **Future:** DB per tenant. |
| NERIS_BASE_URL     | NERIS API (test vs live)            | **Today:** `.env.server` only. **Future:** Stay in env (shared).     |
| Tenant             | One agency/customer (demo, cifpdil) | DB (Tenant + TenantDomain); chosen by hostname.                     |
| Branch             | Line of code (feature/work)          | Git (e.g. `submenu/neris-golive-cifpd`).   |
| Demo + api-test    | Test NERIS with demo tenant         | One proxy with `.env.server` = api-test + test credentials; open app as demo (e.g. localhost). |

If you tell me your exact setup (e.g. “I only run proxy locally” or “I have one Render deploy for staging”), I can map this to concrete steps for you.
