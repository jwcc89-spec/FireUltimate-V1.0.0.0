# Staging vs production: why some data isn’t visible

**Situation:** You created an incident and did a NERIS export a day or two ago; it worked. Now you’re on **cifpdil.fireultimate.app** (production) and don’t see that incident or the export.

---

## Most likely cause: different databases

- **Staging** (e.g. **cifpdil.staging.fireultimate.app**) and **production** (**cifpdil.fireultimate.app**) use **different databases** (see **NEON_PRODUCTION_PROJECT_SETUP.md**).
- Incidents and NERIS export history are stored **per database**, not shared between environments.
- So:
  - If you did the test on **staging** → that incident and export live in the **staging** database only.
  - When you log in on **production** → you’re looking at the **production** database, which was set up with tenants and users but has **no** incidents or export history from staging.

**What to do:**

1. **Confirm where you did the test**  
   Check your browser history or memory: was it **cifpdil.staging.fireultimate.app** or **cifpdil.fireultimate.app**?
2. **If it was staging:**  
   The incident and report are still on staging. To see them again, open **https://cifpdil.staging.fireultimate.app** and log in. They won’t appear on production unless you re-create them there or copy data (see below).
3. **If you need the same incident/export on production:**  
   Re-create the incident on **cifpdil.fireultimate.app** and run the NERIS export again on production. That proves the production flow end-to-end and gives you data in the production DB.

---

## If staging and production share the same database

If you’ve configured **both** staging and production to use the **same** `DATABASE_URL` (same Neon project), then they see the same data. In that case:

- The incident list hides **soft-deleted** incidents (`deletedAt` set). If someone (or a process) soft-deleted the incident, it won’t show in the queue but still exists in the DB.
- Export history is tenant-scoped; if the tenant (cifpdil) and user are correct, it should appear. If it doesn’t, check the browser tab: make sure you’re on the same host (production vs staging) and that the API is returning data (e.g. Network tab for `/api/neris/export-history` and `/api/incidents`).

---

## CAD emails: staging vs production

**Situation:** You see incoming CAD emails in **Admin Functions → Dispatch Parsing Settings** on **cifpdil.staging.fireultimate.app**, but not on **cifpdil.fireultimate.app**.

**Cause:** The **cad-email-ingest-worker** (Cloudflare) sends each received email to **one** API URL: `CAD_INGEST_API_URL` in the worker’s environment. That URL is the **staging** API (e.g. `https://your-staging-api.onrender.com` or similar). So every email is POSTed to staging and stored in the **staging** database. Production uses a **different** API and database, so it never receives those emails.

**What to do:**

1. **To keep testing on staging:** No change; emails will continue to appear only on staging.
2. **To have emails on production:** Configure the worker (or a second worker) so it POSTs to the **production** API base URL (the one that serves **cifpdil.fireultimate.app**). Set **CAD_INGEST_API_URL** in the worker’s env to your production API URL (e.g. `https://your-production-api.onrender.com`), and ensure **CAD_INGEST_SECRET** matches what production expects. Then new emails will be stored in the production DB and appear under **Dispatch Parsing Settings** on **cifpdil.fireultimate.app**. Existing emails will remain only on staging.
3. **To have both:** You’d need two queue consumers or a worker that POSTs to both URLs (not currently in the repo); for now, choose one target (staging or production).

**Raw body in the UI:** The worker sends the raw email as **base64**. The app now decodes it for display so you see the actual MIME content (headers + body) instead of a long base64 string. You can still open “Show raw base64” if needed for debugging.

---

## Quick check: which database is production using?

1. In **Render**, open the service that serves **cifpdil.fireultimate.app**.
2. Go to **Environment** and note the **DATABASE_URL** (e.g. which Neon project/host it points to).
3. Compare with the **DATABASE_URL** for your staging service (e.g. cifpdil.staging).  
   If the hostnames or project names differ, staging and production use different databases, so staging data will not appear on production.
