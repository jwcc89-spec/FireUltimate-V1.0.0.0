# Step-by-Step: Test That Everything Is Working (Beginner-Friendly)

**Where you test:** Staging only — **https://cifpdil.staging.fireultimate.app**  
**You need:** A browser, and (optional) a terminal for the API checks below.

Do the steps in order. After each step, note whether it **passed** or what went wrong.

---

## Test results (staging pass)

**Recorded:** 2026-03-12  
**Part 1 (API):** Run by agent earlier; all curls passed on staging.  
**Part 2 (browser):** 2.1 Pass, 2.2 Pass, 2.3 Pass, 2.4 Pass, 2.5 Pass.  
**Next:** Staging validate/export proof → PR → main → deploy production → first controlled production export. See **GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md** and the “Next steps to complete this pass” section below.

---

## Part 1 — Test the Incident API (optional; ~2 minutes)

The Incident API is already working on staging. You can either **skip this** (the agent already ran these) or run them yourself to see the responses.

**If you want to run them:**

1. Open a **terminal** (e.g. Terminal on Mac, or Command Prompt / PowerShell on Windows).
2. Run each command below, one at a time. Copy and paste the full block for each step.

**Step 1.1 — List incidents (should be empty or show existing ones)**

```bash
curl -s -X GET "https://cifpdil.staging.fireultimate.app/api/incidents" -H "Content-Type: application/json"
```

**You should see:** Something like `{"ok":true,"data":[]}` or `{"ok":true,"data":[...]}`. That means the API is up and the list works.

---

**Step 1.2 — Create one incident**

```bash
curl -s -X POST "https://cifpdil.staging.fireultimate.app/api/incidents" -H "Content-Type: application/json" -d "{\"incidentNumber\":\"CAD-12345\",\"dispatchNumber\":\"D-12345\",\"incidentType\":\"Structure Fire\",\"priority\":\"3\",\"address\":\"123 Main St\",\"stillDistrict\":\"District 1\",\"assignedUnits\":\"E1, L1\",\"currentState\":\"Draft\",\"receivedAt\":\"12:00:00\",\"dispatchInfo\":\"Manual create from API test\"}"
```

**You should see:** A long JSON response that includes `"ok":true` and `"data":{"id":"...", ...}`. Copy the `"id"` value (e.g. `cmmo5g10500003imn75cefgxs`) — you’ll use it in the next steps. If you don’t want to run the rest of the API steps, you can stop here.

---

**Step 1.3 — List again (you should see the new incident)**

```bash
curl -s -X GET "https://cifpdil.staging.fireultimate.app/api/incidents" -H "Content-Type: application/json"
```

**You should see:** `"data":[{ ... }]` with one incident (the one you just created).

---

**Step 1.4 — Get that one incident by id**

Replace `INCIDENT_ID` in the next command with the real `id` you got from Step 1.2 (e.g. `cmmo5g10500003imn75cefgxs`), then run:

```bash
curl -s -X GET "https://cifpdil.staging.fireultimate.app/api/incidents/INCIDENT_ID" -H "Content-Type: application/json"
```

**You should see:** `{"ok":true,"data":{ ... }}` with the same incident.

---

**Step 1.5 — Update it (change address and state)**

Replace `INCIDENT_ID` again, then run:

```bash
curl -s -X PATCH "https://cifpdil.staging.fireultimate.app/api/incidents/INCIDENT_ID" -H "Content-Type: application/json" -d "{\"address\":\"456 Oak Ave\",\"currentState\":\"Dispatched\"}"
```

**You should see:** `"ok":true` and `"data"` with `"address":"456 Oak Ave"` and `"currentState":"Dispatched"`.

---

**Step 1.6 — Soft-delete it, then list with “include deleted”**

Replace `INCIDENT_ID`, then run:

```bash
curl -s -X DELETE "https://cifpdil.staging.fireultimate.app/api/incidents/INCIDENT_ID" -H "Content-Type: application/json" -d "{\"deletedBy\":\"admin\",\"deletedReason\":\"Duplicate\"}"
```

**You should see:** `"ok":true` and `"data"` with `"deletedAt"` and `"deletedBy":"admin"`.

Then run:

```bash
curl -s -X GET "https://cifpdil.staging.fireultimate.app/api/incidents?includeDeleted=true" -H "Content-Type: application/json"
```

**You should see:** The deleted incident still in `data` (with `deletedAt` set). A normal list without `?includeDeleted=true` would not show it.

**Part 1 done.** If all of these showed the expected results, the Incident API is working as desired on staging.

---

## Part 2 — Test in the Browser

Do these on **https://cifpdil.staging.fireultimate.app**. Log in as your cifpdil user if the app asks you to.

---

### Step 2.1 — Incidents Setup (Admin)

**What to do:**

1. Go to **Admin Functions** → **Department Details**.
2. Scroll to **Incidents Setup**.
3. Open each configured field (Incident Type, Priority, Still District, Current State, Reported By).
4. For **dropdown** fields: change an option (add/edit/remove), click **Save** on Department Details, then **reload the page**. The options should still be there.
5. For **Required**: turn Required on or off for a field, save, then open **Create Incident** (Incidents → Mapping → Incidents → Create Incident) and confirm that required fields show validation when left empty.
6. For **Reported By**: switch between Dropdown and Fill-in, save, reload, and confirm the mode is still what you set.

**Success:** Options and required/mode settings save, survive reload, and control how Create Incident and Incident Detail behave.

---

### Step 2.2 — Create an incident and open its detail

**What to do:**

1. Go to **Incidents** → **Mapping** → **Incidents** (the incident list).
2. Click **Create Incident**.
3. Fill in the form (use the fields you set up in Incidents Setup; fill required fields if any).
4. Click **Save** (or the equivalent to create).
5. Check that a **new row** appears in the incident list with the values you entered.
6. **Click that row** to open **Incident Detail**.
7. Confirm all the values you entered are shown correctly.
8. Change one or two fields and save again from Incident Detail.
9. Reload the page (same browser) and open the same incident again.

**Success:** The new incident appears in the list; opening it shows the right data; edits from Incident Detail persist after refresh in the same browser.

**Note:** Today the incident list and incident detail are stored **only in your browser** (localStorage). They do **not** come from the server yet. So they won’t appear on another device or after you clear site data. The Incident API (Part 1) is for when the app later uses the server for incidents.

---

### Step 2.3 — Same incident in the NERIS queue

**What to do:**

1. Go to **Reporting** → **NERIS** (the NERIS queue / export list).
2. Find the **same incident** you created (by its call number or incident number).
3. Check that the columns (e.g. incident type, priority, address, status) match what you see in Incidents | Mapping and in Incident Detail.

**Success:** The incident appears in the NERIS queue with the correct fields carried over from the incident you created/edited.

---

### Step 2.4 — NERIS report form: you can move around

**What to do:**

1. In **Reporting** → **NERIS**, click **one incident row** to open the NERIS report form.
2. Move between sections (scroll, open different parts, use any section navigation).
3. Confirm you are **not** stuck on one screen — you can move around and fill or change fields in any order (aside from normal validation).

**Success:** You can navigate the form freely; nothing locks you to a single section.

---

### Step 2.5 — Incident values on the NERIS form

**What to do:**

1. On the NERIS report form, check that values from **incident creation** (e.g. incident number, incident type, address, priority) appear where expected (e.g. in the Core section).
2. If the flow allows, change a value on the NERIS form and save or export; then open the incident again from Incidents or the NERIS queue and confirm the app shows the updated values where designed.

**Success:** Incident values show correctly on the NERIS form, and any updates from the form are reflected where the app is designed to show them.

---

## Quick reference

| Part | What you did | Success = |
|------|----------------|-----------|
| 1.1–1.6 | (Optional) Run curl commands for list, create, get, patch, delete, list-with-deleted | API returns expected JSON and status |
| 2.1 | Incidents Setup: options, required, mode | Saves, reloads, drives Create Incident/Detail |
| 2.2 | Create incident; open detail; edit and save | Row appears; detail correct; edits persist (same browser) |
| 2.3 | Open Reporting → NERIS; check same incident | Field crossover from incident to NERIS queue correct |
| 2.4 | Open NERIS report form; move around | Navigation not locked |
| 2.5 | Check incident values on NERIS form | Values correct; updates reflect where designed |

---

## When you’re done

- For **Part 1:** Note whether you ran it and if any curl returned something unexpected.
- For **Part 2:** For each step 2.1–2.5, say **Pass** or describe what failed (where, what you did, what you expected).

That's enough for the next agent (or you) to know that everything is working as desired or what to fix.

---

## Next steps to complete this pass

After 2.1–2.5 all pass, the sequence to **complete the staging/go-live pass** is:

1. **Staging validate/export proof** — Run one full flow on staging: create (or use) an incident → open NERIS report → fill/validate → **Export**; confirm export succeeds and NERIS receives it (or you see success in the app).
2. **Open PR** — Branch `submenu/neris-golive-cifpd` → `main` (or your main branch name).
3. **Merge and deploy** — Merge the PR, let production deploy (e.g. Render).
4. **Production checks** — Re-run tenant context and NERIS health/entity-check on production (see GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md for curl commands).
5. **First controlled production export** — One real export on production with production NERIS (when you're ready).

**Optional later:** Step 4 of the Incident plan (frontend uses Incident API so incidents persist across browsers/devices) can be done after go-live if you want that next.
