# CAD Email Ingest Worker

Cloudflare Worker that receives email (e.g. **cifpdil@cad.fireultimate.app**), pushes to a queue, and consumes from the queue to POST to the FireUltimate API.

## Deploy (so you can select this Worker in Step 1.4)

1. **Log in to Cloudflare** (same account that has the **cad.fireultimate.app** zone):
   ```bash
   npx wrangler login
   ```

2. **Create the queue** (one-time; optional — consumer may auto-create it):
   ```bash
   npx wrangler queues create cad-email-ingest
   ```

3. **Install and deploy** from this directory:
   ```bash
   cd cad-email-ingest-worker
   npm install
   npx wrangler deploy
   ```

4. **Set the API URL** in Cloudflare Dashboard:
   - Go to **Workers & Pages** → **cad-email-ingest-worker** → **Settings** → **Variables and Secrets**.
   - Add **CAD_INGEST_API_URL** = your FireUltimate API URL + path, e.g.  
     `https://fireultimate-prod-api.onrender.com/api/cad/inbound-email`  
     (or your staging URL for testing).

5. **(Optional)** If you set **CAD_INGEST_SECRET** on the FireUltimate server, add the same value as a **Secret** named **CAD_INGEST_SECRET** in the Worker so the Worker sends it in the `X-CAD-Ingest-Secret` header.

## Worker name for Email Routing

When you bind the custom address **cifpdil** to “Send to a Worker” in **Email** → **Email Routing** (zone **cad.fireultimate.app**), select:

- **cad-email-ingest-worker**

## FireUltimate server

- Run the new migration so the `CadEmailIngest` table exists:
  ```bash
  npx prisma migrate deploy
  ```
- The endpoint **POST /api/cad/inbound-email** is implemented in the main server. Optional env: **CAD_INGEST_SECRET** to require the Worker to send `X-CAD-Ingest-Secret`.
