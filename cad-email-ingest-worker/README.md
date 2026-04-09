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

5. **CAD_INGEST_SECRET (required for deployed APIs):** On Render (staging and production), **`NODE_ENV`** is usually **`production`**, and the FireUltimate API **requires** **`CAD_INGEST_SECRET`** for **`POST /api/cad/inbound-email`** (otherwise **503**). Add the same value as a **Secret** named **`CAD_INGEST_SECRET`** in the Worker so each POST includes header **`X-CAD-Ingest-Secret`**. For **local** API runs without **`NODE_ENV=production`**, the secret is optional.

## Worker name for Email Routing

When you bind the custom address **cifpdil** to “Send to a Worker” in **Email** → **Email Routing** (zone **cad.fireultimate.app**), select:

- **cad-email-ingest-worker**

## FireUltimate server

- Run the new migration so the `CadEmailIngest` table exists:
  ```bash
  npx prisma migrate deploy
  ```
- The endpoint **POST /api/cad/inbound-email** is implemented in the main server. When **`NODE_ENV=production`**, **`CAD_INGEST_SECRET`** must be set on the server and on the Worker (`X-CAD-Ingest-Secret`).
