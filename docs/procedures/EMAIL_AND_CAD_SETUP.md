# Email and CAD Setup (Combined Guide)

**Purpose:** This is the **single guide** for:

1. **Part A (optional)** — Set up **jeremy@fireultimate.app** on Google Workspace (business email).
2. **Part B** — Set up the **CAD dispatch address** (cifpdil@fireultimate.app or cifpdil@cad.fireultimate.app) using Cloudflare Email Routing + Worker so dispatch emails reach the FireUltimate API and are stored in the database.

**For agents:** This doc replaces **CAD_EMAIL_CIFPDIL_FIREULTIMATE_APP_SETUP.md**, **CAD_EMAIL_INGEST_SETUP_GUIDE.md**, and **EMAIL_GOOGLE_AND_CAD_CLOUDFLARE_SETUP.md**. Use this file only when working on email or CAD ingest.

**Result (Part B):** Mail to your CAD address → Cloudflare → **cad-email-ingest-worker** → queue → **POST /api/cad/inbound-email** → stored in **CadEmailIngest** table. Later you can give the address to dispatch and (when implemented) parse emails to create/update incidents.

---

## Overview: CAD email flow

```
CAD dispatch (or you) sends email to cifpdil@fireultimate.app or cifpdil@cad.fireultimate.app
       │
       ▼
Cloudflare Email Routing (receives mail for that address)
       │  custom address → Send to a Worker
       ▼
cad-email-ingest-worker (receives email, pushes to queue)
       │
       ▼
Queue consumer POSTs to FireUltimate API
       │
       ▼
POST /api/cad/inbound-email → store in CadEmailIngest → (later) parse and create incidents
```

**Address options:**

- **cifpdil@fireultimate.app** — Custom address on the **root** zone fireultimate.app. Use this if you don’t need a separate subdomain.
- **cifpdil@cad.fireultimate.app** — Use this if you add the **cad** subdomain in Cloudflare (Email Routing → Add subdomain **cad**), then create the custom address **cifpdil** for that subdomain.

**If you use Part A (Google):** Part B must **not** remove or replace your Google MX records. Use the CAD address on the root zone or add the cad subdomain so Cloudflare doesn’t overwrite apex MX.

---

## Where to view incoming CAD emails (e.g. cifpdil@cad.fireultimate.app)

When an email is sent to your CAD address (e.g. **cifpdil@cad.fireultimate.app** or **cifpdil@fireultimate.app**), it is captured and stored. You can confirm receipt and view the content here:

| Where | How |
|-------|-----|
| **Render (API logs)** | Render Dashboard → your API Web Service (e.g. fireultimate-api-staging or production) → **Logs**. Look for **POST /api/cad/inbound-email** with status **200**. This confirms the Worker called the API and the request was accepted. |
| **Neon (database)** | **Neon** → your project → **SQL Editor**. Run a query against the **CadEmailIngest** table. Each row is one received email. Example to see latest emails with full body for parsing: |
| | `SELECT id, "tenantId", "fromAddress", "toAddress", "rawBody", "headersJson", "createdAt" FROM "CadEmailIngest" ORDER BY "createdAt" DESC LIMIT 20;` |
| | **Columns:** `fromAddress`, `toAddress` = sender and your CAD address; **`rawBody`** = full email body (use this for parsing/editing); `headersJson` = headers; `createdAt` = when it was stored. |
| **In-app UI** | **Admin Functions → Dispatch Parsing Settings.** Lists incoming CAD emails (From, To, received time); expand a row to view raw body. Parsing rules and auto-create incidents are planned (see **CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md**). |

**Before giving the address to dispatch:** Run the B8 test (send a test email, then check Render logs or Neon) so you know emails are reaching the API and the **CadEmailIngest** table. After you send the address to the CAD Dispatch center, view incoming mail in **Admin Functions → Dispatch Parsing Settings** (or Neon); parsing/editing rules will be added in a later update.

---

## Before You Start

- **Cloudflare:** Zone **fireultimate.app** in your account.
- **Google (Part A):** Admin access to Google Workspace (or plan to create an account).
- **Code:** **cad-email-ingest-worker** is in the repo (`cad-email-ingest-worker/`).
- **Server:** FireUltimate API deployed; you will run the **CadEmailIngest** migration in Part B.

---

# Part A — Set Up jeremy@fireultimate.app on Google Workspace (optional)

**Goal:** Create **jeremy@fireultimate.app** and have mail for **@fireultimate.app** delivered to Gmail.

Do Part A **first** if you want business email on Google. Then do Part B. If Part B asks you to remove MX records, **do not remove them** (see Part B intro).

---

## A1. Sign up or open Google Workspace

1. Go to [Google Workspace](https://workspace.google.com/) and sign in with a Google account you’ll use as the admin.
2. If you don’t have a Workspace account: get started, choose a plan, enter **fireultimate.app** when asked for a domain.
3. If you already have Google Workspace, go to the Admin console and add the domain **fireultimate.app** (A2).

---

## A2. Add the domain fireultimate.app

1. Open [admin.google.com](https://admin.google.com) → **Account** → **Domains** → **Manage domains**.
2. **Add a domain** → **Add a domain to your account** → enter **fireultimate.app** → **Continue**.
3. Choose **Yes, I have access to this domain** (verify via DNS in Cloudflare). **Continue**.

---

## A3. Verify ownership with a TXT record (in Cloudflare)

1. In the Google screen, copy the **TXT value** (e.g. `google-site-verification=...`).
2. In **Cloudflare** → **fireultimate.app** → **DNS** → **Records** → **Add record**.
3. **Type:** TXT | **Name:** `@` | **Content:** paste the value | **Proxy:** DNS only. **Save**.
4. Back in Google, click **Verify**. If it fails, wait 5–10 minutes and try again.

---

## A4. Add MX records so mail goes to Google

1. In **Google Admin** → **Domains** → **fireultimate.app** → **Set up email** (or Gmail setup). Note the MX records.
2. In **Cloudflare** → **fireultimate.app** → **DNS**: remove any existing apex MX records, then **Add record**.
3. **Type:** MX | **Name:** `@` | **Mail server:** `smtp.google.com` (or what Google shows) | **Priority:** 1 | **Proxy:** DNS only. **Save**. Add all MX records Google lists if more than one.

---

## A5. Create the user jeremy@fireultimate.app

1. **Google Admin** → **Directory** → **Users** → **Add new user**.
2. **Primary email:** **jeremy** (domain **fireultimate.app** → full address **jeremy@fireultimate.app**). Set password.
3. **Add new user**. Sign in at [mail.google.com](https://mail.google.com) with **jeremy@fireultimate.app**.

---

## A6. Optional: Send a test email

Send an email to **jeremy@fireultimate.app** from another account and confirm it arrives in Gmail.

**Part A done.** Next: Part B (CAD address and Worker).

---

# Part B — Set Up CAD Address and Worker

**Goal:** Receive CAD dispatch mail at **cifpdil@fireultimate.app** or **cifpdil@cad.fireultimate.app** and send it to **cad-email-ingest-worker**, which POSTs to the FireUltimate API.

**Important:** If Cloudflare asks you to **delete or replace existing MX records** (Google’s), **do not confirm**. That would break **jeremy@fireultimate.app**. Use **cifpdil@fireultimate.app** (root zone) or add the **cad** subdomain so you don’t overwrite apex MX.

---

## B1. Open Email Routing for fireultimate.app

1. **Cloudflare Dashboard** → **Websites** → **fireultimate.app** → **Email** → **Email Routing**.
2. If you see **Get started** or **Enable Email Routing**, click it.
3. **If it says you must remove existing MX records (Google’s):** Do **not** remove them. Cancel or go back; use **cifpdil@fireultimate.app** as the CAD address (custom address on root) or add the **cad** subdomain (B2) so routing doesn’t require replacing apex MX.
4. If it lets you continue without removing MX, or offers **Add subdomain**, continue. Add any records Cloudflare requests and complete the enable step.

---

## B2. Add the subdomain for cad (optional — for cifpdil@cad.fireultimate.app)

1. In **Email** → **Email Routing**, look for **Settings** or **Subdomains** or **Add subdomain**.
2. If you want **cifpdil@cad.fireultimate.app**, click **Add subdomain** and enter **cad**. Save and wait a moment.
3. If you prefer **cifpdil@fireultimate.app** only, skip this step.
4. Continue to B3.

---

## B3. Create the custom email address

1. **Email** → **Email Routing** → **Custom addresses** (or **Routing rules**) → **Create address**.
2. **Custom address:**
   - For **cifpdil@fireultimate.app**: enter **cifpdil@fireultimate.app** or local part **cifpdil**, domain **fireultimate.app**.
   - For **cifpdil@cad.fireultimate.app**: enter **cifpdil@cad.fireultimate.app** or local part **cifpdil**, domain **cad.fireultimate.app** (only if you did B2).
3. **Action:** **Send to a Worker**. If the UI requires selecting a Worker now and it’s not deployed yet, complete B4–B5 first, then return and select **cad-email-ingest-worker**.
4. **Save**.

---

## B4. Deploy the cad-email-ingest Worker

1. Terminal, from project root:
   ```bash
   cd cad-email-ingest-worker
   npx wrangler login
   npx wrangler queues create cad-email-ingest
   npm install
   npx wrangler deploy
   ```
2. You should see the Worker **cad-email-ingest-worker** deployed. Set the API URL in B5, then connect the custom address to this Worker in B7.

---

## B5. Set the Worker’s API URL

The Worker needs the **full URL** of the FireUltimate API endpoint. In **Cloudflare** → **Workers & Pages** → **cad-email-ingest-worker** → **Settings** → **Variables and Secrets**:

- **Variable name:** `CAD_INGEST_API_URL`
- **Value (pick one):**
  - Staging (test first): `https://cifpdil.staging.fireultimate.app/api/cad/inbound-email`
  - Production: `https://cifpdil.fireultimate.app/api/cad/inbound-email`
- No trailing slash. **Save**.
- **Secret (required for staging/production APIs):** Add a **Secret** named **`CAD_INGEST_SECRET`** (long random string). Use the **same value** on your **Render API** service as environment variable **`CAD_INGEST_SECRET`**. The Worker sends it as header **`X-CAD-Ingest-Secret`** on every POST. If the API runs with **`NODE_ENV=production`** (typical on Render) and **`CAD_INGEST_SECRET`** is missing on the API, **`POST /api/cad/inbound-email` returns 503** until you set it. If the Worker secret and API secret do not match, the API returns **401**.

---

## B6. Run the database migration

This creates the **CadEmailIngest** table. Prisma reads **DATABASE_URL** from **.env** by default; this project uses **.env.server** for server-side env, so we run the migration with that file loaded.

**B6.1 — Go to project root**

- If your terminal prompt shows **cad-email-ingest-worker**, run: `cd ..`
- You must be in the folder that contains `prisma/` and `server/` (project root).

**B6.2 — Ensure .env.server has DATABASE_URL**

- In the project root, open **.env.server** (copy from **.env.server.example** if it doesn’t exist).
- Set **DATABASE_URL** to your PostgreSQL connection string (e.g. from Neon: project → Connection string). Save.

**B6.3 — Install dotenv if needed**

- In project root: `npm install dotenv`

**B6.4 — Run migration with .env.server**

From **project root** (not inside cad-email-ingest-worker):

```bash
node --env-file=.env.server -e "require('child_process').execSync('npx prisma migrate deploy', {stdio:'inherit', env: process.env})"
```

- Success: you see migrations apply (including **`20260312200000_add_cad_email_ingest`** when not yet applied) and **“All migrations have been successfully applied.”**
- **datasource.url property is required** → .env.server missing or DATABASE_URL empty. **Can’t reach database server** → check DATABASE_URL and network.

### B6.5 — CAD parsing config + allowlist tables (after Batch C in code)

The same **`prisma migrate deploy`** command applies **`20260409140000_add_cad_parsing_settings_and_allowlist`**, which creates **`CadParsingSettings`** and **`CadEmailAllowlistEntry`**. Run deploy against **each** environment’s database (staging Neon, production Neon, etc.) whenever you deploy an API build that includes those routes.

**Tenant-scoped HTTP APIs** (browser on tenant host, `credentials: include`):

- **`GET /api/cad/parsing-config`** — parsing flags + rule JSON placeholders (used by future Dispatch Parsing UI).
- **`PATCH /api/cad/parsing-config`** — partial update; merges into existing row or creates one.
- **`GET /api/cad/allowlist`** — list allowlist entries.
- **`PATCH /api/cad/allowlist`** — body `{ "entries": [ { "pattern", "patternType?", "enabled?", "sortOrder?" } ] }` replaces **all** rows for the tenant.

**Allowlist enforcement** on ingest is **not** active until **Batch D**; see **`docs/plans/CAD_DISPATCH_PARSING_IMPLEMENTATION_PLAN.md`**.

---

## B7. Connect the custom address to the Worker

1. **Cloudflare** → **fireultimate.app** → **Email** → **Email Routing**.
2. Under **Custom addresses**, find **cifpdil** (or **Email Workers** / **Routes**).
3. Edit the address or add a route so that **cifpdil@fireultimate.app** or **cifpdil@cad.fireultimate.app** (whichever you created) has **Action: Send to a Worker** → **cad-email-ingest-worker**.
4. **Save**.

---

## B8. Test CAD email

1. Send a test email to your CAD address (**cifpdil@fireultimate.app** or **cifpdil@cad.fireultimate.app**).
2. **Confirm** one of these:
   - **Render:** Dashboard → your API Web Service → **Logs**. Look for **POST /api/cad/inbound-email** with status **200**.
   - **Neon:** SQL Editor → run:
     ```sql
     SELECT id, "toAddress", "fromAddress", "createdAt" FROM "CadEmailIngest" ORDER BY "createdAt" DESC LIMIT 5;
     ```
     You should see a row with **toAddress** = your CAD address and **createdAt** near when you sent the email.

---

## B9. Troubleshooting (no logs or DB row)

1. **Address:** You must send to the address you configured (root or cad subdomain). If you use **cifpdil@cad.fireultimate.app** without adding the cad subdomain in B2, mail won’t reach Cloudflare.
2. **Custom address → Worker:** **Email** → **Email Routing** → **Custom addresses**. **cifpdil** must show **Action: Send to a Worker** and **Worker: cad-email-ingest-worker**. Edit and save if not.
3. **CAD_INGEST_API_URL:** **Workers & Pages** → **cad-email-ingest-worker** → **Settings** → **Variables and Secrets**. Must be exactly e.g. `https://cifpdil.staging.fireultimate.app/api/cad/inbound-email` (no trailing slash).
4. **Route exists?** In a terminal (add **`-H "X-CAD-Ingest-Secret: YOUR_SECRET"`** if the API has **`CAD_INGEST_SECRET`** set):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -X POST "https://cifpdil.staging.fireultimate.app/api/cad/inbound-email" -H "Content-Type: application/json" -H "X-CAD-Ingest-Secret: YOUR_SECRET" -d '{"from":"test@test.com","to":"cifpdil@fireultimate.app","raw":"","headers":{}}'
   ```
   **200** = route exists and secret accepted. **503** = API is production mode but **`CAD_INGEST_SECRET`** is not set on Render — add it and redeploy. **401** = wrong or missing **`X-CAD-Ingest-Secret`** (fix Worker secret or curl header). **404** = deploy the branch that has the CAD route (e.g. submenu/neris-golive-cifpd) to staging.
5. **Worker logs:** **Workers & Pages** → **cad-email-ingest-worker** → **Logs**. Send another test email; if no logs, the Worker isn’t triggered (routing or address misconfigured).
6. **Render logs:** Check that any request appears when you send the email; if not, the Worker isn’t calling your API (wrong URL or Worker not consuming queue).

---

## B10. Optional: Forward jeremy@fireultimate.app to Gmail

If you enabled Email Routing on the root and want **jeremy@fireultimate.app** to land in your personal Gmail:

1. **Email** → **Email Routing** → **Custom addresses** → **Create address**.
2. **Custom address:** `jeremy` | **Action:** **Send to an email** | **Destination:** your Gmail (verify in **Destination addresses** first). **Save**.

---

## B11. Switching the Worker from staging to production (before go-live)

**Recommendation: use one Worker and one CAD address.** When you are ready for production, change the Worker’s **Variables and Secrets** from staging to production. You do **not** need a second Worker unless you want to receive CAD mail at **both** staging and production at the same time (e.g. two different addresses); for most setups, one Worker and one address is simpler and dispatch only needs one place to send.

**When to do this:** Before you give the CAD address to dispatch for real use, or when you merge to `main` and deploy the production API.

**Steps:**

1. **Cloudflare** → **Workers & Pages** → **cad-email-ingest-worker** → **Settings** → **Variables and Secrets**.
2. **CAD_INGEST_API_URL:** Change from staging to production:
   - **Production value:** `https://cifpdil.fireultimate.app/api/cad/inbound-email` (no trailing slash).
3. **CAD_INGEST_SECRET:** Set the Worker’s **CAD_INGEST_SECRET** Secret to the **same** value as **`CAD_INGEST_SECRET`** on your **production** Render API. Production APIs use **`NODE_ENV=production`**, which **requires** this secret on the API and Worker. If staging and production use different secrets, switch the Worker value when you change **CAD_INGEST_API_URL** (B11).
4. **Save.** The Worker will then send all incoming CAD emails to your production API.

**If you ever want staging and production both receiving:** You would create a second Worker (e.g. `cad-email-ingest-staging`) and a second custom address (e.g. `cifpdil-staging@cad.fireultimate.app`), with the staging Worker’s **CAD_INGEST_API_URL** pointing at staging. Dispatch would use the production address only; you’d use the staging address for tests. For a single tenant, one Worker switched to production when going live is usually enough.

---

## Summary

| What | Where |
|------|--------|
| **jeremy@fireultimate.app** | Google Workspace (Part A): TXT + MX in Cloudflare, user in Admin. |
| **cifpdil@fireultimate.app** or **cifpdil@cad.fireultimate.app** (CAD) | Cloudflare (Part B): Email Routing, custom address **cifpdil** (root or **cad** subdomain) → **cad-email-ingest-worker**. Give this address to dispatch. |

**Checklist:** Part A (optional) → B1–B3 (routing + address) → B4–B5 (Worker + API URL) → B6 (migration) → B7 (connect address to Worker) → B8 (test) → **B11 (switch Worker to production before go-live)** → give address to dispatch.

---

## Appendix: Option B (cad subdomain) via Cloudflare API — reference only

Cloudflare’s “Add a site” accepts only **root** domains. Creating a zone for **cad.fireultimate.app** via the **API** can return error 1116 (“root domain only”). In practice, many accounts can add the **cad** subdomain from the **Email Routing** UI (B2) and then use **cifpdil@cad.fireultimate.app** without using the API. If you need to create the **cad** zone via API (e.g. for automation), use the same Cloudflare account and:

1. **GET** `/client/v4/accounts` and **GET** `/client/v4/zones?name=fireultimate.app` to get account ID and zone ID.
2. **POST** `/client/v4/zones` with `"name": "cad.fireultimate.app"` (may return 1116).
3. If successful, add **two NS records** in the **fireultimate.app** zone for **cad**, using the nameservers from the create response.
4. When **cad.fireultimate.app** is Active, enable Email Routing for that zone and create the custom address **cifpdil** there.

If the API rejects subdomain zone creation, use **cifpdil@fireultimate.app** (root zone) or the in-dashboard “Add subdomain” under Email Routing (B2) if available.
