# CAD dispatch — staging verification checklist (operator)

**Purpose:** Step-by-step checks you can run on **staging** after the API and Worker are deployed, **before** you rely on CAD email in production.

**Who runs this:** Product owner (or delegate with **admin** access to the staging tenant).

**How long:** About **30–45 minutes** the first time.

**Related runbook:** `docs/procedures/EMAIL_AND_CAD_SETUP.md` (Cloudflare, Worker, secret, migrations).

**Implementation plan:** `docs/plans/CAD_DISPATCH_PARSING_IMPLEMENTATION_PLAN.md`.

---

## Critical fact (read this first)

Incoming CAD mail is routed to a tenant by the **local part** of the **To** address (the bit before `@`).

- Example: mail to **`cifpdil@cad.fireultimate.app`** is stored for the tenant whose **slug** in the database is **`cifpdil`**.
- If the **local part does not match any tenant slug**, the email may still be stored with **`tenantId` null**, and it will **not** show under **Admin Functions → Dispatch Parsing Settings** for your department.

**Before testing:** Confirm with your developer which **CAD address** matches which **tenant slug** on staging (often the same word, e.g. `cifpdil`).

---

## What you need before you start

Gather these (write them on paper or a notes app — do not paste secrets into public chat):

| Item | Why you need it |
|------|------------------|
| **Staging app URL** | Example: `https://cifpdil.staging.fireultimate.app` — you must open the app on the **tenant’s hostname**, not a wrong subdomain. |
| **Admin username and password** | For staging only. Role must be **admin** (or equivalent) so **Admin Functions** is visible. |
| **CAD ingest email address** | The address you send test mail **to** (e.g. `cifpdil@cad.fireultimate.app`). Must match **tenant slug** as above. |
| **A second email account** | Gmail, Outlook, etc., to **send** the test message (not the same inbox as the CAD address unless your setup allows it). |

Optional but useful:

| Item | Why |
|------|-----|
| Access to **Render** (or your API host) **Logs** | Confirms `POST /api/cad/inbound-email` returns **200**. |
| Access to **Neon** (or your DB) **SQL Editor** | Confirms a row in **`CadEmailIngest`**. |
| **Cloudflare** access | If email never reaches the API, routing or Worker issues live here. |

---

## 1. Confirm you can log in to staging

1. Open your browser (Chrome or Safari is fine).
2. In the address bar, type your **staging app URL** exactly (example: `https://cifpdil.staging.fireultimate.app`). Press **Enter**.
3. If you see a certificate warning, stop and ask your developer — do not bypass security unless they told you to.
4. Log in with your **staging admin** username and password.
5. **Success:** You see the main dashboard (or home screen), not a login error.

**If login fails:** Reset password only through a process your developer approves; confirm you are on **staging**, not production.

---

## 2. Confirm Admin Functions is available

1. Look for **Admin Functions** in the main navigation (exact label may match your build).
2. Click **Admin Functions**.
3. **Success:** You see a list of admin areas (Department Details, Dispatch Parsing Settings, etc.).

**If you do not see Admin Functions:** Your account may not be **admin** on this tenant. Ask your developer to raise your role or use an admin test account.

---

## 3. Open Dispatch Parsing Settings

1. Under **Admin Functions**, find **Dispatch Parsing Settings** (or **CAD** / **dispatch** wording — same feature).
2. Click it. The app may open **Raw Email** first or redirect to a default sub-page.
3. **Success:** You see tabs or links such as **Raw Email**, **Message Parsing**, **Incident Parsing**.

---

## 4. Raw Email — list loads

1. Click **Raw Email** if you are not already there.
2. Wait a few seconds for the list to load.
3. **Success:** You see either a list of rows (From, To, time) **or** an empty list with no red error banner.

**If you see an error** (“Failed to load”, “Unauthorized”, etc.): Note the **exact message**, take a screenshot, and send it to your developer. Do not continue to step 5 until this works.

---

## 5. Send a test CAD email

1. Open a **different** browser tab.
2. Log in to your personal email (Gmail, Outlook, etc.).
3. Click **Compose** / **New message**.
4. **To:** type your **CAD ingest address** exactly (example: `cifpdil@cad.fireultimate.app`).
5. **Subject:** `Staging CAD test` (any text is fine).
6. **Body:** Type a short plain message, for example:  
   `TEST — address 123 Main St — nature fire — time 14:30:00`
7. Click **Send**.

**Success:** The mail sends without bounce (check **Sent** folder).

---

## 6. Wait and refresh the Raw Email list

1. Wait **1–2 minutes** (Cloudflare Worker + queue + API can add a short delay).
2. Go back to the **Raw Email** tab in the FireUltimate staging app.
3. Click **Refresh** if your page has a refresh control, or reload the browser page (**Ctrl+R** / **Cmd+R**).
4. **Success:** A **new row** appears with **To** = your CAD address and a **recent** time.

**If no row appears after 5 minutes:** Go to **§ Troubleshooting** at the bottom of this doc. Do not assume failure until you check Render logs or Neon (steps 7–8).

---

## 7. (Optional) Confirm in Render API logs

1. Open **Render** (or your hosting dashboard) in a new tab.
2. Select the **staging API** web service (name from your developer).
3. Open **Logs**.
4. Search or scroll for **`POST /api/cad/inbound-email`** around the time you sent the email.
5. **Success:** A line shows **200** (or **2xx**) for that route.

**If you see 401:** Secret mismatch — Worker and API **`CAD_INGEST_SECRET`** must match (see `EMAIL_AND_CAD_SETUP.md`).

**If you see 503:** API may be missing **`CAD_INGEST_SECRET`** in production mode.

**If there is no request:** The Worker may not be calling staging (wrong **`CAD_INGEST_API_URL`**) or email never reached Cloudflare.

---

## 8. (Optional) Confirm in Neon (database)

1. Open **Neon** → your **staging** project → **SQL Editor**.
2. Run (copy-paste):

```sql
SELECT id, "tenantId", "fromAddress", "toAddress", "createdAt"
FROM "CadEmailIngest"
ORDER BY "createdAt" DESC
LIMIT 10;
```

3. **Success:** The top row matches your test send (**fromAddress** ≈ your personal email, **toAddress** = CAD address).

4. If **`tenantId` is null:** The **local part** of **toAddress** did not match a tenant **slug**. Fix the address or tenant record with your developer before expecting rows in the in-app list for that department.

---

## 9. Message Parsing (optional first pass)

Goal: confirm **rules + preview** work; **no need** for perfect parsing on the first try.

1. Click **Message Parsing**.
2. Wait until the **rules** text area loads (JSON rules — later replaced by a friendlier UI in Batch K).
3. If your developer gave you a **minimal test rule**, paste it and click **Save**, then **Preview** (or rely on auto-preview per build).
4. **Success:** After **Save**, a new inbound email (step 5) gets a non-empty **`parsedMessageText`** in Neon if message rules are configured — or at least no error banner in the UI.

If you skip custom rules, **parsedMessageText** may stay empty until rules exist; Raw Email still proves **ingest** works.

---

## 10. Incident Parsing — safety check

Automatic incident creation can create **draft incidents**. For a **first** staging test, keep automation **off** unless your developer asks otherwise.

1. Click **Incident Parsing**.
2. Find **Enable Incident Creation** (or similar).
3. Ensure it is **OFF** / **disabled**.
4. Click **Save** if you changed it.

Later, when you intentionally test automation, your developer will give you merge-key and rule examples.

---

## Pass / fail summary

| Check | Pass criteria |
|-------|----------------|
| Login | Admin can open staging tenant URL. |
| Dispatch Parsing | Raw Email, Message Parsing, Incident Parsing open without error. |
| Ingest | Test email appears in **Raw Email** within a few minutes **or** is visible in Neon with correct **toAddress**. |
| Tenant link | **`tenantId`** is **not** null for that row when you expect it tied to your department (see **Critical fact**). |

---

## Troubleshooting (short)

1. **Nothing in app but row in Neon with `tenantId` null:** Fix **To** address local part vs tenant **slug** (see top of this doc).
2. **Nothing anywhere:** Follow **B9** in `EMAIL_AND_CAD_SETUP.md` (routing, Worker URL, secret).
3. **Allowlist rejection:** If your tenant has allowlist entries enabled, **From** must match — add your test sender or temporarily clear allowlist (developer-assisted).

---

## After staging passes

1. Document the **exact** CAD address and tenant slug you used.
2. When you switch the Worker to **production** (see **B11** in `EMAIL_AND_CAD_SETUP.md`), repeat a **short** test (steps 5–6) on **production** before giving the address to dispatch.

---

*Batch I deliverable — operator checklist. Update this file when routes or labels change.*
