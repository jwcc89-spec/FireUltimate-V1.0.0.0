# Phase 1: Get cifpdil Tenant Live

**Goal:** The **cifpdil** tenant exists, has status **active**, and is reachable at the **production** hostname `cifpdil.fireultimate.app` so users can log in and use the app there.

**Out of scope for Phase 1:** NERIS URL/credentials switch and live report push (those are Phase 2). This phase is only: tenant + domain + DNS so “cifpdil live” is reachable.

---

## Prerequisites

- You have **database access** (same DB that your **production** app uses, or the one you want for production).  
  - `DATABASE_URL` in `.env.server` (or `.env`) must point to that DB when you run the commands below.
- You have **DNS access** for `fireultimate.app` (e.g. Cloudflare) so you can add or confirm a record for `cifpdil.fireultimate.app`.
- For **Render:** You’ll set env vars in the Render dashboard (not in `.env.server` in the repo). Phase 1 doesn’t change NERIS env; it only ensures the tenant and hostname work.
- `tenant:create` now loads env from `.env` and `.env.server` automatically, so `DATABASE_URL` can come from either file.

---

## Step 1.1 — Check if cifpdil already exists

Run this from the **project root** (same folder as `package.json`). It lists all tenants and their domains.

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

**What you’re looking for:**

- If you see a tenant with `"slug": "cifpdil"`:
  - Note its **domains** (e.g. `cifpdil.staging.fireultimate.app` only, or already `cifpdil.fireultimate.app`).
  - Note its **status** (e.g. `trial` vs `active`).
- If there is **no** tenant with slug `cifpdil`, you’ll create it in Step 1.2 Option B.

**Expected vs actual:**
- **Expected success:** JSON array prints with tenant objects and `domains` arrays.
- **If failure says `DATABASE_URL` missing:** add it to `.env.server` or `.env`, save, and rerun.

---

## Step 1.2 — Create tenant or add production domain

### Option A — cifpdil already exists

- If it **already** has a domain `cifpdil.fireultimate.app`, skip to Step 1.3.
- If it only has **staging** (e.g. `cifpdil.staging.fireultimate.app`), add the **production** hostname:

  1. Get the tenant’s **id** from the list in Step 1.1 (e.g. `"id": "cmmf7rjy30001b2fj5fr4hc1p"`).
  2. Start your proxy (so the admin API is up):  
     `npm run proxy`
  3. In **another terminal**, run (replace `TENANT_ID`, `YOUR_PLATFORM_ADMIN_KEY`, and the URL if your API is not on localhost):

     ```bash
     curl -X POST http://localhost:8787/api/admin/tenants/TENANT_ID/domains \
       -H "Content-Type: application/json" \
       -H "X-Platform-Admin-Key: YOUR_PLATFORM_ADMIN_KEY" \
       -d '{"hostname":"cifpdil.fireultimate.app","isPrimary":false}'
     ```

  - **Success:** HTTP 201 and a JSON body with the new domain.
  - **403:** Wrong or missing `X-Platform-Admin-Key` (check `PLATFORM_ADMIN_KEY` in `.env.server`).
  - **If your app runs on Render:** Use your Render service URL instead of `http://localhost:8787`, and use the same `PLATFORM_ADMIN_KEY` value you set in Render’s Environment.

### Option B — cifpdil does not exist

Create the tenant with **production** hostname and **active** status:

```bash
npm run tenant:create -- \
  --slug cifpdil \
  --name "Crescent-Iroquois Fire Protection District - IL" \
  --hostname cifpdil.fireultimate.app \
  --status active \
  --adminUsername admin \
  --adminPassword "CHOOSE_A_SECURE_PASSWORD"
```

Replace `CHOOSE_A_SECURE_PASSWORD` with a real password and store it somewhere safe (e.g. password manager). You’ll need it to log in as cifpdil admin.

**What this does:** Creates the tenant, one domain `cifpdil.fireultimate.app`, empty DepartmentDetails, and one admin user. No staging hostname is added. If you need **both** staging and production hostnames, after this run the “add domain” curl from Option A to add `cifpdil.staging.fireultimate.app` (use the tenant id from the script output).

**Expected vs actual:**
- **Expected success:** terminal prints `Tenant created successfully.` and JSON with `tenantId`, `slug`, `status`, `hostname`.
- **If failure says tenant already exists:** use Option A instead (add/check domain and status).
- **If failure says hostname already assigned:** verify which tenant already owns that hostname.

---

## Step 1.3 — Ensure status is **active**

- If you created cifpdil in Step 1.2 Option B with `--status active`, you’re done for this step.
- If cifpdil already existed with status `trial` (or anything else) and you want it **active** for production:

  You have to update the DB. For example, with Prisma (run from project root, same DB as production):

  ```bash
  node --env-file=.env.server --input-type=module -e "
  import { PrismaPg } from '@prisma/adapter-pg';
  import pkg from '@prisma/client';
  import { Pool } from 'pg';
  const { PrismaClient } = pkg;
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
  const updated = await prisma.tenant.update({
    where: { slug: 'cifpdil' },
    data: { status: 'active' }
  });
  console.log('Updated:', JSON.stringify(updated, null, 2));
  await prisma.\$disconnect();
  "
  ```

  **Expected:** JSON with `"status": "active"` for the cifpdil tenant.

---

## Step 1.4 — DNS and SSL for cifpdil.fireultimate.app

- In your DNS provider (e.g. Cloudflare for `fireultimate.app`):
  - Either **wildcard:** `*.fireultimate.app` → CNAME to your **production** app host (e.g. your Render service host),  
  - Or **single record:** `cifpdil` (or `cifpdil.fireultimate.app`) → CNAME to that same production host.
- Ensure **SSL/TLS** is enabled so `https://cifpdil.fireultimate.app` works (Render usually provides this once DNS points to it).

---

## Step 1.5 — Verify

1. **Tenant context (API)**  
   Open in browser or run:

   ```bash
   curl -s https://cifpdil.fireultimate.app/api/tenant/context
   ```

   **Expected:** JSON with `"tenant": { "slug": "cifpdil", ... }`. If you get a connection error, DNS or Render isn’t set up yet.

2. **Login**  
   Go to `https://cifpdil.fireultimate.app`, log in with the cifpdil **admin** user (username/password from tenant creation or your records). You should see the app as that tenant.

3. **Optional — list tenants again**  
   Re-run the command from Step 1.1 and confirm cifpdil has domain `cifpdil.fireultimate.app` and `status: "active"`.

4. **Render dashboard check (recommended)**  
   Open Render -> your production service -> **Environment** and confirm expected app envs are present (for tenant hosting readiness): `DATABASE_URL`, `SESSION_SECRET`, `PORT` (platform-provided), and any required app vars.  
   Note: NERIS live URL/credentials are configured in Phase 2.

---

## Phase 1 checklist

- [ ] Step 1.1: Ran tenant list; confirmed whether cifpdil exists and its domains/status.
- [ ] Step 1.2: Either added domain `cifpdil.fireultimate.app` to existing cifpdil (Option A) or created cifpdil with that hostname (Option B).
- [ ] Step 1.3: cifpdil has status `active`.
- [ ] Step 1.4: DNS (and SSL) for `cifpdil.fireultimate.app` points to production app.
- [ ] Step 1.5: `/api/tenant/context` returns cifpdil and login at `https://cifpdil.fireultimate.app` works.

When all are done, **Phase 1 is complete**: cifpdil tenant is live and reachable. Next (Phase 2) is switching NERIS to production URL/credentials and pushing a live report (see main plan doc).
