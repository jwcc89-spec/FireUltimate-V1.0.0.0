# Staging Test Checklist — Detailed & Beginner-Friendly

**Branch:** `submenu/neris-golive-cifpd`  
**Last updated:** 2026-03-12  
**Purpose:** Step-by-step checklist for your staging validation. Everything is split into: **what you do**, **what the agent can do**, and **what the agent needs from you.**

---

## Important: Where incident data lives today

- **Incident queue and created incidents** (the list you see under Incidents | Mapping | Incidents, and each created incident’s details) are stored **only in your browser** (localStorage), keyed by host (e.g. `cifpdil.staging.fireultimate.app`).
- They are **not** saved to the server or database. So:
  - If you clear site data or use a different browser/device, the incident list and created incidents will not appear there.
  - “Save” on Create Incident and on Incident Detail updates the in-browser queue only.
- **Incidents Setup** (Admin → Department Details → Incidents Setup) **is** saved via the API: when you save Department Details, that config is sent to `POST /api/department-details` and stored per tenant.

**If you want incidents to be saved via API (so they persist across browsers/devices):**  
See the step-by-step plan and “incident numbers” explanation in **`INCIDENT_NUMBERS_AND_API_PERSISTENCE_PLAN.md`** in this folder. The agent can implement it in batches after you approve the schema; you only run one migration command and test. For now, this checklist assumes the current behavior (incident queue = browser only) so you can complete your staging flow tests.

### Auto-assigned incident number (top left)

- The value in the **top left** on the incident detail page and the NERIS report form is the incident’s **call number** (e.g. `I-20260312-120412`).
- It is **auto-generated** when you create a new incident: format `I-YYYYMMDD-HHMMSS` (date + time at creation). Example: created on 2026-03-12 at 12:04:12 → `I-20260312-120412`.
- **Why it exists:** The app uses this as the **unique key** for each incident in the in-browser queue: incident list, detail URL, NERIS draft storage, and export history all key off it. Without a stable id, you couldn’t have multiple incidents or open a specific one.
- **Is it necessary?** For the **current** design (incidents only in the browser), **yes**. Once incidents are **saved via API**, the server can assign the incident number (or a separate display number), and the UI can show whatever the API returns; the “auto-assign” would then be replaced by a server-assigned id.

---

## Local vs staging: when is `npm run dev` + `npm run proxy` enough?

**Would it be quicker?**  
Yes. You avoid waiting for Render to deploy after each commit. You run `npm run proxy` and `npm run dev`, make changes, and test immediately.

**Would the same testing work locally?**  
Only if you test as the **same tenant** with the **same API data** as staging.

- **Settings (Incidents Setup, Department Details) are saved via API and are per-tenant.**  
  So the app must resolve to tenant **cifpdil** when you test, and the proxy must use the **staging database** (same `DATABASE_URL` as Render staging), so you see and save the same Department Details / Incidents Setup as on cifpdil.staging.fireultimate.app.
- **If you only run `npm run dev` and `npm run proxy` and open `http://localhost:5173`:**  
  The proxy resolves **localhost** → tenant **demo**, not cifpdil. You get **demo**’s data (different Incidents Setup, different Department Details). That’s useful for general UI testing but **not** the same as testing cifpdil go-live flow.

**So:**

| Goal | Use |
|------|-----|
| Quick iteration, same cifpdil data and NERIS config as staging | Local with **cifpdil.localhost** (see below) + `.env.server` `DATABASE_URL` = staging DB (and NERIS env same as staging). Then open `http://cifpdil.localhost:5173`. |
| Quick iteration, don’t care about tenant (e.g. navigation, layout) | `npm run dev` + `npm run proxy`, open `http://localhost:5173` (tenant = demo). |
| Final check on real staging host and deploy | `cifpdil.staging.fireultimate.app` after Render deploy. |

**One-time setup to test as cifpdil locally (same data as staging):**

1. **Hosts file:** Add a line so `cifpdil.localhost` points to your machine, e.g.  
   `127.0.0.1 cifpdil.localhost`  
   (On macOS/Linux: `sudo nano /etc/hosts`; add the line; save.)
2. **Tenant domain:** Add the hostname for cifpdil so the proxy can resolve it. Using the same DB as staging (e.g. Neon staging), run once (replace `TENANT_ID` and `PLATFORM_ADMIN_KEY`):  
   `curl -X POST http://localhost:8787/api/admin/tenants/TENANT_ID/domains -H "Content-Type: application/json" -H "X-Platform-Admin-Key: PLATFORM_ADMIN_KEY" -d '{"hostname":"cifpdil.localhost","isPrimary":false}'`  
   (Get `TENANT_ID` from your tenant list or DB; it’s the cifpdil tenant id.)
3. **Env:** In `.env.server`, set `DATABASE_URL` to your **staging** DB (same as Render staging) and NERIS vars to match staging (e.g. api-test). Then start proxy and dev.
4. **Open:** `http://cifpdil.localhost:5173` and log in as cifpdil (same credentials as staging). You’ll see the same Incidents Setup and API-backed data as staging, with no deploy wait.

After that, you can use local (cifpdil.localhost) for most testing and only hit `cifpdil.staging.fireultimate.app` when you want to confirm the real staging deploy.

---

## Part A: What YOU do (your testing flow)

Do these in order. After each step, note any bug or confusion so we can fix or clarify.

### Step A1 — Test Incident Setup fields (you are here)

**Where:** Staging → log in as cifpdil → **Admin Functions** → **Department Details** → scroll to **Incidents Setup**.

**What to do:**

1. Open each configured field (Incident Type, Priority, Still District, Current State, Reported By).
2. For each:
   - **If it’s a dropdown:** Confirm the option list matches what you expect (same options you added in Incidents Setup). Add/edit/remove an option, save Department Details, reload the page, and confirm the options persist.
   - **If it’s “fill-in” (e.g. Reported By):** Confirm you can type freely and that required vs optional behavior matches the checkboxes in Incidents Setup.
3. Toggle **Required** on/off for a field, save Department Details, then open **Create Incident** and confirm required vs optional behavior (e.g. required fields show validation when empty).
4. For **Reported By**, switch between **Dropdown** and **Fill-in** mode, save, reload, and confirm the mode persists and behaves correctly in Create Incident.

**Success looks like:**  
Options and required/mode settings save, survive reload, and drive Create Incident and Incident Detail as expected.

**If something fails:**  
Note the exact field, what you did, and what you expected. The agent can then fix or adjust.

---

### Step A2 — Create a new incident in Incidents | Mapping

**Where:** Staging → **Incidents** → **Mapping** → **Incidents** (the incident list).

**What to do:**

1. Click **Create Incident**.
2. Fill in the modal using the fields you configured in Incidents Setup (required fields must be filled if marked required).
3. Save (full or partial, depending on required settings).
4. Confirm a new row appears in the incident list with the values you entered.
5. Click that row to open **Incident Detail**.
6. Confirm all created values appear correctly and that you can edit and save again from Incident Detail.

**Success looks like:**  
New incident appears in the list; opening it shows correct data; editing and saving from Incident Detail updates the row and persists after page refresh (in the same browser).

**If something fails:**  
Note which field or step failed (e.g. “Create Incident modal didn’t save” or “Incident Detail didn’t show address”). The agent can fix.

---

### Step A3 — Correct fields crossover to the NERIS queue

**Where:** Staging → **Reporting** → **NERIS** (the NERIS queue / export list).

**What to do:**

1. With at least one incident in the list (from Step A2), open **Reporting** → **NERIS**.
2. Find the same incident in the NERIS queue (same incident number / call number).
3. Check that the columns (e.g. incident type, priority, address, status) show the **same values** as in Incidents | Mapping | Incidents and in Incident Detail.

**Success looks like:**  
Incident appears in the NERIS queue with correct crossover of fields from the incident you created/edited.

**If something fails:**  
Note which fields are wrong or missing (e.g. “Priority is blank in NERIS queue but set in Incident Detail”). The agent can fix the mapping.

---

### Step A4 — NERIS report form: navigation is not locked

**Where:** Staging → **Reporting** → **NERIS** → click an incident row → NERIS report form opens.

**What to do:**

1. Open the NERIS report form for one incident.
2. Move between sections (e.g. scroll, open different parts of the form, use any section nav if present).
3. Confirm you are **not** blocked or forced to stay on one screen; you can move around and fill/change fields in any order (subject to normal validation).

**Success looks like:**  
You can navigate the form freely; nothing “locks” you to a single section or blocks navigation.

**If something fails:**  
Describe what “locked” means (e.g. “I can’t leave Section X until I fill Y” or “Back button doesn’t work”). The agent can adjust navigation/validation.

---

### Step A5 — Values from incident creation are present (and where they’re saved)

**What to check:**

1. On the NERIS report form, confirm that values that came from **incident creation** (e.g. incident number, incident type, address, priority) appear where expected (e.g. incident number, incident type, location).
2. Change a value on the NERIS form and save/submit or export if the flow allows; then re-open the incident in Incidents or NERIS queue and confirm the app shows the updated values where designed (e.g. incident number synced back to queue).

**Where things are saved today:**

- **Incident queue and incident rows (Create Incident, Incident Detail):**  
  Saved **only in the browser** (localStorage). Not sent to the server. So they do **not** persist across devices or after clearing site data.

- **Department Details (including Incidents Setup):**  
  Saved **via API** (`POST /api/department-details`). Persists per tenant on the server.

- **NERIS export:**  
  Sent to the server when you click Export (`POST /api/neris/export`). NERIS receives the payload; the app may also update the in-browser queue (e.g. incident number) from the form.

**If you want incident creation/detail to be “saved via API (not local browser cache)”:**  
Tell the agent explicitly. The agent will propose a small implementation plan (e.g. new endpoint(s), optional DB table) and **will not** change schema or add new APIs until you approve. Until then, the checklist assumes current behavior (queue = localStorage).

---

## Part B: What the AGENT can do (without you)

The agent will:

- Fix bugs you find in: Incident Setup save/load, Create Incident modal, Incident Detail edit/save, NERIS queue crossover, or NERIS form navigation.
- Run `npm run lint` and `npm run build` after code changes and report pass/fail.
- Update handoff docs (ACTIVE_CONTEXT, session notes) and branch checklist so the next session knows what’s done and what’s next.
- Propose a concrete plan (and wait for your approval) if you ask for incident data to be saved via API instead of localStorage.

The agent will **not**:

- Change Prisma schema, migrations, or auth logic without your explicit approval.
- Add a new incident/API persistence layer until you say you want it and approve the approach.

---

## Part C: What the AGENT needs from YOU

1. **Results of your tests:**  
   For each step (A1–A5), either “Pass” or a short description of what failed (where, what you did, what you expected). That tells the agent exactly what to fix.

2. **Decision on API persistence:**  
   Do you want incident creation and incident detail to be saved via API (server/database) so they persist across browsers/devices?  
   - If **yes:** Say so; the agent will propose a small implementation plan and wait for your approval before changing schema or adding endpoints.  
   - If **no (or not yet):** We keep current behavior (localStorage only for the queue) and continue with the rest of go-live (staging validate/export, then PR → main, deploy, production export).

3. **Go-ahead for next steps:**  
   After your staging tests pass (or after the agent fixes issues you reported), confirm when to proceed to:  
   - Staging validate/export proof, then  
   - PR branch → main, deploy production, first controlled production export.

---

## Quick reference: your testing order

| Step | What you do | Success = |
|------|----------------|----------|
| A1 | Test Incident Setup fields (options, required, mode) | Saves, reloads, drives Create Incident/Detail |
| A2 | Create new incident in Incidents \| Mapping; open detail; edit & save | Row appears; detail correct; edits persist (same browser) |
| A3 | Open Reporting \| NERIS; same incident has correct fields | Field crossover from incident to NERIS queue correct |
| A4 | Open NERIS report form; move around form | Navigation not locked; you can move freely |
| A5 | Confirm incident values on NERIS form; note where data is saved | Values correct; you know queue = browser, Dept Details = API |

---

## After you finish testing

- Reply with: **A1–A5 Pass/Fail** and any failure details.  
- Say whether you want **incidents saved via API** (and the agent will propose a plan for your approval).  
- Say when to proceed to **staging validate/export** and **PR → main / production**.

The agent will then fix any issues in small batches, re-validate, and update the handoff docs and this checklist as needed.
