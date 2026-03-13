# Step-by-Step: Create Neon Production Project and Wire Render

You currently have **fireultimate-staging** in Neon. Production should use a **separate** database. Follow these steps to create **fireultimate-production** and point **fireultimate-prod-api** at it.

---

## 1. Create the production project in Neon

1. Log in at [Neon](https://console.neon.tech).
2. In the top-left (project selector), click the current project name (e.g. **fireultimate-staging**).
3. Click **New Project** (or **Create Project**).
4. Set:
   - **Name:** `fireultimate-prod` (or any clear name you prefer).
   - **Region:** Same as staging is fine (e.g. US East).
   - **Postgres version:** Use the default (e.g. 16).
   - **Neon Auth:** **No.** Leave it off (default). Your app connects with the project’s connection string; you don’t need Neon Auth for this setup.
5. Click **Create project**. Neon will create the project and a default branch (e.g. `main`) with one database (often named `neondb`).

---

## 2. Get the production connection string

1. In the new **fireultimate-prod** project, open the **Dashboard** (home for that project).
2. Find the **Connection string** section. You’ll see something like:
   - **Connection string** (URI): `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`
3. Copy the **full** connection string. You may need to click **Show** or **Copy** next to the password.
4. Keep this secret. You’ll use it in Step 4 (local migration/seed) and Step 6 (Render).

---

## 3. Run migrations on the production database (from your machine)

Your app uses Prisma migrations: a set of instructions that create the right tables in the database. The new Neon production project has an empty database. In this step you run those instructions so the production database has the same structure as staging. You do this once from your own computer, using the production connection string.

---

### 3a. Open the project on your computer

- **“Open the repo”** means: open the **FireUltimate project folder** (the one that contains `package.json`, `prisma/`, `server/`, etc.) in your editor (e.g. Cursor or VS Code) and have that same folder available in the **Terminal**.
- **Which branch?** Use the **main** branch (or whichever branch you use for production). In Terminal you can run `git branch` to see the current branch; if you need main, run `git checkout main`.
- **After a PR was merged:** So your local main has the latest code (including the merged PR), run `git pull` or `git pull --rebase`. Do this whenever you’re about to run migrations or deploy from main and you know main was updated on the remote (e.g. GitHub).
- **Open Terminal in the project folder:** In Cursor/VS Code: **Terminal → New Terminal**. The terminal should start in the project folder (you’ll see the folder name in the prompt). If not, run `cd` and then the full path to your project, e.g. `cd /Users/YourName/CursorProjects/FireUltimate-V1.0.0.0`.
- **Install dependencies (one time):** In that terminal, run:
  ```bash
  npm install
  ```
  Wait until it finishes. You only need to do this if you haven’t already in this project.

---

### 3b. “Temporarily point at the production DB” — what it means and how to do it

- **What it means:** For the next few commands, your computer needs to know *which* database to talk to. Right now it might be using your local or staging database. We’re going to tell it: “use the **production** database” by putting the production connection string in a small file. “Temporarily” means we use this file only for these setup steps; we don’t commit it to git (it’s already in `.gitignore`), and later the production app on Render will use its own `DATABASE_URL` in Render’s environment.

- **How to do it:**

  1. In the **root** of the project (same level as `package.json`), create a new file named **exactly**: `.env.production`  
     (The name starts with a dot. In Cursor/VS Code: **File → New File**, then save as `.env.production` in the project root.)

  2. Open `.env.production` and put **one line** in it (replace the placeholder with your real production connection string from Step 2):
     ```
     DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
     ```
     Paste your **full** connection string from Neon (fireultimate-production) between the quotes. There should be no spaces around the `=`. Example shape (yours will have real values):
     ```
     DATABASE_URL="postgresql://myuser:abc123xyz@ep-cool-name-12345.us-east-1.aws.neon.tech/neondb?sslmode=require"
     ```

  3. Save the file. Do **not** commit this file or share it; it contains the production database password.

---

### 3c. Run the migration commands

You’ll run two commands in the **same** terminal, in the project folder.

1. **Load the production URL into this terminal session.**  
   Run this **exactly** (it reads `.env.production` and exports `DATABASE_URL` for the rest of this terminal session):
   ```bash
   export $(grep -v '^#' .env.production | xargs)
   ```
   You won’t see any output if it worked. That’s normal.

2. **Apply the migrations to the production database.**  
   Run:
   ```bash
   npx prisma migrate deploy
   ```
   - **What this does:** Sends the migration instructions (from the `prisma/migrations/` folder) to the database whose URL is in `DATABASE_URL` — i.e. your new production database.
   - **Success looks like:** A few lines of output ending with something like “X migrations applied” or listing each migration. No red error messages.

3. **If you see an error:** Check that `.env.production` has the correct connection string (no extra spaces, whole URL in one line), that you ran the `export` command in the same terminal before `npx prisma migrate deploy`, and that you’re in the project root (where `prisma/` exists).

---

### 3d. Optional: confirm tables exist

In Neon, open the **fireultimate-production** project → **Tables** (or **SQL Editor**). You should see tables such as `Tenant`, `TenantDomain`, `User`, etc. If you do, the migration ran successfully.

---

## 4. Seed the production database (tenants, domains, admin user)

The seed creates the **cifpdil** and **demo** tenants, **staging** domain mappings, DepartmentDetails shells, and starter users. You’ll add the **production** domain in Step 5.

1. In a terminal in the project root, run:
   ```bash
   node --env-file=.env.production --import tsx prisma/seed.ts
   ```
   This command reads `.env.production` automatically, so you can use the same terminal as Step 3 or a new one. (Do not commit `.env.production`.)
2. You should see “Seed complete” and tenant IDs. The seed only adds:
   - `cifpdil.staging.fireultimate.app` → cifpdil  
   - `demo.staging.fireultimate.app` → demo  
   So production host **cifpdil.fireultimate.app** is not yet mapped; you add it in the next step.

---

## 5. Add the production domain for cifpdil

So that **cifpdil.fireultimate.app** resolves to the **cifpdil** tenant (not demo), add a `TenantDomain` row for that hostname.

**Option A – Neon SQL Editor (simplest)**

1. In Neon, open project **fireultimate-production** → **SQL Editor**.
2. Run:
   ```sql
   INSERT INTO "TenantDomain" ("id", "tenantId", "hostname", "isPrimary")
   SELECT
     'c' || substr(md5(random()::text), 1, 24),
     id,
     'cifpdil.fireultimate.app',
     false
   FROM "Tenant"
   WHERE slug = 'cifpdil';
   ```
3. Check: run `SELECT * FROM "TenantDomain";` and confirm a row with hostname `cifpdil.fireultimate.app` and the cifpdil `tenantId`.

**Option B – One-off script (from repo)**

A script in the repo adds the domain using the same production `DATABASE_URL`:

1. Put the production connection string in `.env.production` (do not commit it). Example line: `DATABASE_URL="postgresql://..."`
2. From repo root, run:
   ```bash
   node --env-file=.env.production scripts/add-production-domain.mjs
   ```
   You should see: `Added TenantDomain: cifpdil.fireultimate.app -> cifpdil`. If the domain already exists, the script reports that and exits.

---

## 6. Set DATABASE_URL (and other vars) in Render for production

1. In [Render](https://dashboard.render.com), open the **fireultimate-prod-api** service.
2. Go to **Environment**.
3. Set **DATABASE_URL** to the **exact** production connection string you copied in Step 2 (from **fireultimate-production** in Neon).
4. Add or update any other production env vars (e.g. NERIS_*, other app config). Do **not** use staging credentials here if you use separate NERIS apps for staging vs prod.
5. Save. Render will redeploy the service with the new env. After deploy, the production API will use the **fireultimate-production** database.

---

## 7. Confirm production is correct

1. Open **cifpdil.fireultimate.app** in a browser and log in (e.g. admin / the password you set in seed or that you use for prod).
2. Check that:
   - You see real (or seeded) department data and no demo sample data on the Incidents tab (if you had demo data, that would suggest wrong tenant or wrong DB).
   - **GET** `https://cifpdil.fireultimate.app/api/tenant/context` returns `slug: "cifpdil"` (not `"demo"`).
3. In Neon, leave **fireultimate-staging** as the DB for your **staging** Render service so staging and prod stay separate.

---

## Summary checklist

- [ ] Neon: New project **fireultimate-production** created.
- [ ] Production connection string copied.
- [ ] `npx prisma migrate deploy` run against production `DATABASE_URL`.
- [ ] `npm run db:seed` run against production `DATABASE_URL`.
- [ ] **TenantDomain** row added for `cifpdil.fireultimate.app` (SQL or script).
- [ ] Render **fireultimate-prod-api** → Environment → **DATABASE_URL** set to production connection string.
- [ ] Redeploy (if needed) and verify **cifpdil.fireultimate.app** and `/api/tenant/context` show **cifpdil**.

---

**Security:** Do not commit `.env.production` or paste the real connection string into chat or docs. Use Render’s secret env vars and Neon’s connection string only in secure places.
