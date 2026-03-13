# CAD Dispatch via Email — C1 + Durable Queue (Step-by-Step Guide)

**Branch:** `submenu/neris-golive-cifpd`  
**Purpose:** Get incident information from your CAD dispatch center via email using **Cloudflare Email Routing + a durable queue**. CAD sends to a custom address (e.g. `cad@fireultimate.app`) → Cloudflare receives it → an Email Worker pushes the message to a queue → a consumer sends it to the FireUltimate API. You get **near real-time delivery** (seconds) and **no lost messages** if the API is down (messages stay in the queue and are retried).

Do the steps in order. **You** do the Cloudflare dashboard setup and give the address to dispatch; **the agent** creates the queue, the Worker code, and the API endpoint.

---

## Overview: What We’re Building

```
CAD dispatch center
       │
       ▼  sends email to cad@yourdomain.com
Cloudflare Email Routing (receives mail)
       │
       ▼  custom address "Send to a Worker"
Email Worker (runs when email arrives)
       │  reads message, pushes to queue
       ▼
Cloudflare Queue (durable buffer; messages stay until processed)
       │
       ▼  consumer runs every few seconds or when batch is ready
Queue Consumer (inside same Worker or your server)
       │  POSTs to FireUltimate API with retries
       ▼
FireUltimate API  →  store email  →  (later) parse and create/update incidents
```

**Why this approach:** Speed (seconds from send to API) + reliability (if the API is down, the queue holds messages and the consumer retries until success).

---

## Who Does What — Quick Reference

| Step | Who | What |
|------|-----|------|
| 1. Enable Email Routing and create custom address | **You** | Cloudflare Dashboard: Email → Email Routing → enable, verify destination, create address `cad@...` (you’ll connect the Worker in Step 4). |
| 2. Create queue and deploy Worker | **Agent** | Create Cloudflare Queue, write and deploy Worker (email handler + queue producer + queue consumer), document env vars. |
| 3. Add API endpoint and queue consumer target | **Agent** | Add `POST /api/cad/inbound-email` (or equivalent) on FireUltimate server to receive and store emails; consumer POSTs here with retries. |
| 4. Connect address to Worker and set API URL | **You** | Cloudflare: bind `cad@...` to “Send to a Worker” (select the deployed Worker); set Worker env var `CAD_INGEST_API_URL`. |
| 5. Give address to dispatch | **You** | Tell CAD: “Send incident notifications to **cad@yourdomain.com**.” |
| 6. Test and later parse | **You** + **Agent** | You: send a test email. Agent: after sample received, add parser and map to incident fields. |

---

## Part 1 — You: Enable Cloudflare Email Routing and Create the Custom Address

**Goal:** Turn on Email Routing for your domain and create the address that dispatch will use (e.g. `cad@fireultimate.app`). You will connect this address to the Worker in **Part 4** after the agent deploys the Worker.

**Prerequisite:** Your domain (e.g. `fireultimate.app`) is already on Cloudflare (DNS managed by Cloudflare).

**Important:** Enabling Email Routing lets Cloudflare receive **all** email for this domain (or subdomain). If you already use another provider (e.g. Google Workspace) for `@fireultimate.app`, enabling Email Routing on the root domain would conflict. In that case use a **subdomain** for CAD only (e.g. `cad@mail.fireultimate.app` and add Email Routing for `mail.fireultimate.app`). The steps below assume the root domain or a subdomain dedicated to this.

---

### Step 1.1 — Open Email Routing in Cloudflare

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) and log in.
2. Click your **account** (right side) if you have more than one.
3. In the left sidebar, click **Websites** (or **Sites**) and select the **zone** for your domain (e.g. **fireultimate.app**).
4. In the left sidebar for that zone, click **Email** → **Email Routing**.
5. You should see the **Email Routing** page (Destination addresses, Custom addresses, etc.).

---

### Step 1.2 — Enable Email Routing (First Time Only)

1. If you see **Get started** or **Enable Email Routing**, click it.
2. Cloudflare will show the **MX and TXT records** it will add to your DNS. Click **Add records and finish** (or **Add records and enable**).
3. If Cloudflare says **other MX records exist** and asks to remove them, only confirm if this domain (or subdomain) is dedicated to CAD email. Otherwise, use a subdomain for CAD (e.g. `mail.fireultimate.app`) and enable Email Routing there.
4. After the records are added, Email Routing is **on**. You may be prompted to add a **destination address** next.

---

### Step 1.3 — Add and Verify a Destination Address

Cloudflare requires at least one **verified** destination address before you can create custom addresses (even when using “Send to a Worker”). This can be any email you control (e.g. your own inbox); it is used for verification only unless you also create a rule that forwards to it.

1. On the Email Routing page, find **Destination addresses**.
2. Click **Add destination address** (or **Create address** in that section).
3. Enter a full email you control (e.g. `you@yourdomain.com` or your personal Gmail).
4. Click **Add** (or **Save**). Cloudflare will send a **verification email** to that address.
5. Open that email and click the **Verify email address** (or similar) link. The destination should now show **Verified** in the dashboard.

---

### Step 1.4 — Create the Custom Address for CAD

1. On the same Email Routing page, find **Custom addresses** (or **Routing rules** / **Create address**).
2. Click **Create address** (or **Create custom address**).
3. Fill in:
   - **Custom address:** Enter the local part only, e.g. **cad** (the full address will be `cad@fireultimate.app`, or `cad@mail.fireultimate.app` if you use a subdomain).
   - **Destination / Action:** Choose **Send to a Worker**. You will **select the Worker** in Part 4 after the agent deploys it. For now you can **skip saving this rule** and add it in Part 4, or if the UI requires a Worker now, the agent must deploy the Worker first (see Part 2), then you return here.
4. If the UI lets you leave the Worker unselected: **Save** and note the address (e.g. `cad@fireultimate.app`). You will come back in **Part 4** to select the Worker.
5. If the UI requires selecting a Worker now: tell the agent to complete **Part 2** first, then return to this step and select the deployed Worker.

**Note:** Some flows show “Send to a Worker” with a dropdown of existing Workers. If the Worker is not deployed yet, complete Part 2 (agent deploys Worker), then in Part 4 you will edit this custom address and set its action to “Send to a Worker” and select that Worker.

---

### Step 1.5 — Note Your Settings for the Agent

Write down and give to the agent:

- **Full CAD ingest address:** e.g. `cad@fireultimate.app` (or `cad@mail.fireultimate.app`).
- **Domain (zone) name:** e.g. `fireultimate.app` (so the agent can target the right zone when deploying the Worker).
- **Confirmation:** “Email Routing is enabled; custom address created; I will connect it to the Worker in Part 4.”

---

## Part 2 — Agent: Create the Queue and Deploy the Email + Queue Worker

**Goal:** Create a Cloudflare Queue, then a Worker that (1) receives incoming email and pushes it to the queue, and (2) consumes from the queue and POSTs to the FireUltimate API. The user will bind the custom address to this Worker in Part 4 and set the API URL.

**Agent tasks:**

1. **Create the queue** (one-time, via Wrangler):
   ```bash
   npx wrangler queues create cad-email-ingest
   ```
   Use the same Cloudflare account/zone as the user’s domain (or document which account the user should run this in).

2. **Create a Worker** that:
   - **Email handler:** Exports an `email(message, env, ctx)` handler. When Cloudflare delivers an email to the Worker (from the custom address “Send to a Worker”):
     - Read `message.from`, `message.to`, and `message.raw` (stream). Serialize the raw body (e.g. base64 or string) and send to the queue: `env.CAD_EMAIL_QUEUE.send({ from: message.from, to: message.to, raw: serializedBody, headers: Object.fromEntries(message.headers) })`.
   - **Queue producer binding:** In `wrangler.jsonc` (or `wrangler.toml`): bind the queue `cad-email-ingest` as a **producer** with a binding name (e.g. `CAD_EMAIL_QUEUE`).
   - **Queue consumer handler:** Exports a `queue(batch, env, ctx)` handler. For each message in `batch.messages`, POST the payload to the URL in `env.CAD_INGEST_API_URL` (e.g. `POST /api/cad/inbound-email`). Use retries (e.g. `message.retry()` on failure) and respect Cloudflare Queue consumer semantics (ack on success, retry or dead-letter on failure). Set `max_batch_size` and `max_batch_timeout` (e.g. 5 seconds) so messages are processed quickly.
   - **Queue consumer binding:** In the same Wrangler file, add a **consumer** for `cad-email-ingest` so this Worker receives batches from the queue.
   - **Secrets / env:** The Worker needs `CAD_INGEST_API_URL` (the full URL to the FireUltimate endpoint). Document for the user: “In Cloudflare Dashboard → Workers & Pages → [this Worker] → Settings → Variables and Secrets, add **CAD_INGEST_API_URL** = `https://your-api.fireultimate.app/api/cad/inbound-email` (or your staging URL for testing).”

3. **Deploy the Worker** to the user’s account (e.g. `npx wrangler deploy`), and ensure it is attached to the same account/zone so it appears under “Send to a Worker” for the user’s domain.

4. **Document for the user:**
   - The **exact Worker name** (e.g. `cad-email-ingest-worker`) so they can select it in Part 4.
   - That they must add the **CAD_INGEST_API_URL** secret/env in the Worker’s settings.
   - That the queue is created and the consumer will retry failed POSTs until success (and optionally configure a dead-letter queue later).

---

## Part 3 — Agent: FireUltimate API Endpoint and Storage

**Goal:** The queue consumer POSTs to the FireUltimate server. The agent implements the endpoint and storage so emails are stored and (later) can be parsed into incidents.

**Agent tasks:**

1. **Add an endpoint** (e.g. `POST /api/cad/inbound-email`) that:
   - Accepts a JSON body (e.g. `{ from, to, raw, headers }`) matching what the queue consumer sends.
   - Validates and stores the email (e.g. in a `CadEmailIngest` table or equivalent) with tenant context if available (e.g. from headers or a shared secret so only the Cloudflare Worker can call this).
   - Returns 2xx on success so the queue consumer can ack the message; returns 4xx/5xx on failure so the consumer can retry.

2. **Secure the endpoint** (e.g. shared secret in header, or allowlist of Cloudflare Worker IPs if applicable). Document the secret for the user so they can add it to the Worker env if needed.

3. **Do not** implement parsing/incident creation in this first batch; that comes after the user sends a sample email (see Part 6).

---

## Part 4 — You: Connect the Custom Address to the Worker and Set the API URL

**Goal:** In Cloudflare, set the custom address to “Send to a Worker” and select the Worker the agent deployed. Then set the Worker’s API URL (and any secret) so the consumer can POST to your FireUltimate API.

---

### Step 4.1 — Bind the Custom Address to the Worker

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → your **account** → **Websites** → select your **zone** (e.g. fireultimate.app).
2. Left sidebar: **Email** → **Email Routing**.
3. Under **Custom addresses**, find the address you created (e.g. **cad**).
4. Click **Edit** (or the address).
5. Set **Action** to **Send to a Worker**.
6. In the **Worker** dropdown, select the Worker the agent deployed (e.g. **cad-email-ingest-worker**).
7. **Save**.

From now on, any email sent to `cad@fireultimate.app` (or your custom address) will be delivered to this Worker, which will push it to the queue.

---

### Step 4.2 — Set the Worker’s API URL (and Optional Secret)

1. In the left sidebar, go to **Workers & Pages**.
2. Click the Worker name (e.g. **cad-email-ingest-worker**).
3. Open **Settings** → **Variables and Secrets** (or **Environment Variables**).
4. Add a **Variable** (or **Secret** if you prefer it encrypted):
   - **Name:** `CAD_INGEST_API_URL`
   - **Value:** Your FireUltimate API base URL + path, e.g. `https://your-api.fireultimate.app/api/cad/inbound-email` (use staging URL for testing if you prefer).
5. If the agent documented a **secret header** (e.g. `X-CAD-Ingest-Secret`), add that as another variable (e.g. `CAD_INGEST_SECRET`) and ensure the Worker sends it in the POST.
6. **Save** and ensure the Worker is redeployed if needed (usually saving env vars does not require a redeploy; the Worker reads them at runtime).

---

### Step 4.3 — Verify

Send a **test email** from your own inbox to `cad@fireultimate.app` (or your custom address). Within a few seconds:

- The email should be received by Cloudflare and pushed to the queue.
- The consumer should POST to your API. Check your FireUltimate server logs (or database) to confirm the email was stored.

If something fails, the agent can help debug (queue depth, Worker logs, and API response codes).

---

## Part 5 — You: Give the Address to Dispatch

Tell your CAD dispatch center:

“Please send all incident/call notifications to this email address: **cad@fireultimate.app**” (or whatever address you created).

No need to share any passwords or technical details; they only need the address.

---

## Part 6 — Test Email and Later: Parsing (You + Agent)

1. **You:** Have dispatch send a **real or sample** incident email to the CAD ingest address (or forward one yourself). Confirm it appears in your system (e.g. in `CadEmailIngest` or equivalent).
2. **Agent:** Once a sample email is available, design the **parser** (subject/body → incident number, address, type, priority, units, time, etc.) and map to FireUltimate’s incident create/update API so incidents show up under **Incidents | Mapping | Incidents** and can be used for NERIS reporting.

---

## Checklist — Do This Now vs Later

| Step | Who | What |
|------|-----|------|
| 1. Enable Email Routing, verify destination, create custom address | **You** | Part 1: Cloudflare Dashboard, step-by-step above. |
| 2. Create queue and deploy Email + Queue Worker | **Agent** | Part 2: Wrangler + Worker code (email → queue, queue → POST API). |
| 3. Add FireUltimate API endpoint and storage | **Agent** | Part 3: `POST /api/cad/inbound-email`, store email, secure endpoint. |
| 4. Bind address to Worker and set CAD_INGEST_API_URL | **You** | Part 4: Email Routing → Edit address → Send to Worker; Worker Settings → Variables. |
| 5. Give address to dispatch | **You** | Part 5: Tell CAD to send to cad@yourdomain.com. |
| 6. Send test email and then add parsing | **You** + **Agent** | You: send/forward sample. Agent: parser and incident mapping. |

---

## Summary

- **You:** Enable Cloudflare Email Routing, create the custom address (e.g. `cad@fireultimate.app`), then in Part 4 connect it to the Worker and set `CAD_INGEST_API_URL`. Give the address to dispatch.
- **Agent:** Create the queue, deploy the Worker (email → queue, queue consumer → POST to API with retries), and add the FireUltimate API endpoint that stores incoming emails. Later, add parsing and incident mapping after a sample email is received.

This gives you **C1 speed** (seconds from send to API) and **durable-queue reliability** (no lost messages when the API is down).
