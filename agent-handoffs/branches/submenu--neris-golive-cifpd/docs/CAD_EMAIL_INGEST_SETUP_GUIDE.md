# CAD Dispatch via Email — Step-by-Step Setup Guide (Beginner-Friendly)

**Branch:** `submenu/neris-golive-cifpd`  
**Purpose:** Get incident information from your CAD dispatch center via email: (1) set up an email address for them to send to, (2) have the server monitor that inbox, (3) later we parse the email and auto-fill incident fields in FireUltimate.

Do the steps in order. **You** do the email and dispatch coordination; **the agent** adds the monitoring and parsing once the inbox is ready and we have a sample email.

---

## Overview: What We’re Building

1. **An email address** — You give this to the CAD dispatch center. They send incident/call information to it (e.g. when a call is dispatched).
2. **Monitoring** — The server (or a small program that runs with the server) checks that inbox on a schedule or receives messages in real time, so we don’t have to manually forward emails.
3. **Into the system** — Each received email is stored and then, in a later step, parsed so we can create or update incidents in FireUltimate and fill the right fields (address, type, units, etc.).

**Cost note:** Email is the chosen, low-cost way to receive data from dispatch. No direct CAD API or expensive integration required.

---

## Part 1 — Set Up the Email Address (You Do This)

You need **one dedicated email address** that only CAD dispatch will use. That keeps dispatch traffic separate and makes monitoring and parsing simpler.

### Option A — Gmail (simplest to start)

1. **Create a new Gmail account** (e.g. `cifpd.dispatch@yourdomain.com` if you use Google Workspace, or something like `cifpd.dispatch.fireultimate@gmail.com`).
2. **Security:**
   - Turn on **2-Step Verification** for that account (Google account → Security).
   - Then create an **App password**: Google account → Security → 2-Step Verification → App passwords → generate one for “Mail” or “Other.” You’ll give this **only** to the server (or the agent) so it can read the inbox; never put it in the frontend or in public docs.
3. **Give the address to dispatch:**  
   Tell the CAD dispatch center: “Send incident/call notifications to this address: **your-chosen@email.com**.”
4. **Note down for the agent:**
   - The **email address** (e.g. `cifpd.dispatch.fireultimate@gmail.com`).
   - That you’re using **Gmail** (we’ll use IMAP to read it).

**Do this now:** Create the account, turn on 2-Step Verification, create an App password, give the address to dispatch, and save the address (and that it’s Gmail) for the next step.

---

### Option B — Microsoft 365 / Outlook.com

1. **Create a dedicated mailbox** (e.g. a shared mailbox or a separate account like `cifpd-dispatch@yourdomain.com`).
2. **Security:**
   - Use **modern auth** (OAuth2) if the server supports it, or an **app password** if you use one for “application” access. Keep credentials only on the server, never in the frontend.
3. **Give the address to dispatch** and **note for the agent:** the **email address** and that you’re using **Microsoft 365 / Outlook** (we’ll use IMAP or Microsoft Graph depending on what we implement).

**Do this now:** Create the mailbox, secure it, give the address to dispatch, and note the address and “Microsoft/Outlook” for the agent.

---

### Option C — Custom domain (e.g. your own mail host or a provider)

1. **Create one address** on your domain (e.g. `cad@yourdepartment.org`) that receives mail.
2. **Decide how the server will read mail:**
   - **IMAP** — If your host supports IMAP, we can poll the inbox (same idea as Gmail).
   - **Inbound webhook** — Some providers (e.g. SendGrid Inbound Parse, Mailgun, Postmark) let you forward incoming mail to a URL. Then the server doesn’t need to poll; it receives a POST when an email arrives. This is nicer for “real time” but requires a public URL and provider setup.
3. **Give the address to dispatch** and **note for the agent:** the **email address**, the **provider/host name**, and whether you prefer **IMAP** or **inbound webhook** (if your provider supports it).

**Do this now:** Create the address, give it to dispatch, and write down the address, provider, and preferred method (IMAP vs webhook) for the agent.

---

## Part 2 — How the Server Will Monitor That Email (Agent Does This Next)

After you have the inbox and have given the address to dispatch, the **next step** is to add **monitoring** so the server (or a small process next to it) can see new messages. Two common approaches:

### Approach A — IMAP polling (works with Gmail, Outlook, most hosts)

- **What it is:** A script or job (e.g. Node.js) that runs on a schedule (e.g. every 1–5 minutes). It connects to the mailbox with IMAP using the credentials you stored securely (e.g. in env vars), lists new messages, and downloads them (headers + body).
- **Where it runs:** On the same machine or environment as your FireUltimate server (e.g. Render), or a small worker/cron that has network access to the mail server.
- **Credentials:** Stored only on the server (e.g. `CAD_EMAIL_IMAP_HOST`, `CAD_EMAIL_USER`, `CAD_EMAIL_APP_PASSWORD` in `.env.server` or your host’s config). Never in the frontend or in code in the repo.
- **Output:** Each new email is saved (e.g. to a table like `CadEmailIngest` or to files) so we can parse them in the next phase.

**You do:** Provide the agent with the email address and that you’re using Gmail (or Outlook/custom) so we know to use IMAP and which host/port to use. **You do not** put the app password in the repo; we’ll tell you exactly which env vars to set (e.g. on Render or in `.env.server`).

---

### Approach B — Inbound webhook (if your provider supports it)

- **What it is:** The email provider (e.g. SendGrid, Mailgun) receives the message and immediately sends the contents (or a link) to a URL on your server (e.g. `https://your-api.fireultimate.app/api/cad/inbound-email`). The server handles the POST and stores the message.
- **Pros:** Near real time; no polling.
- **Cons:** You need a public HTTPS URL and must configure the provider to point to it; you may need to use their address (e.g. a SendGrid inbound address) and give *that* to dispatch instead of a plain Gmail address.

**You do:** Only if you choose this path — sign up for the provider, create an inbound address, and give *that* address to dispatch. Then tell the agent the provider and that you want webhook-based ingestion.

---

**Recommendation for cost and ease:** Start with **Option A (Gmail) + Approach A (IMAP polling)**. You create one Gmail, give it to dispatch, and the agent adds a small IMAP poller and stores incoming messages. Once we have a sample email from dispatch, we add parsing and field mapping.

---

## Part 3 — How Data Gets Into FireUltimate (After Monitoring Is In Place)

High level (no need to do this yourself yet):

1. **Email arrives** → Monitoring job picks it up (IMAP or webhook) and **stores** it (e.g. subject, body, date, from).
2. **Parser (later)** → We write a small “parser” that looks at the subject/body and extracts things like: incident number, address, type, priority, units, time, etc. Format depends on what dispatch actually sends (we’ll design this after you have a **sample email** from them).
3. **Into the app** → The server uses the **Incident API** (or internal create/update) to create or update an incident with the parsed data, so it shows up in **Incidents | Mapping | Incidents** and can be used for NERIS reporting.

**You do later:** Send a **test email** from dispatch (or forward a real one) to the ingest address so we have a real sample. Then we’ll design the parser and map fields to Create Incident / Incident Detail.

---

## Checklist — Do This Now vs Later

| Step | Who | What |
|------|-----|------|
| 1. Create dedicated email for CAD | **You** | Gmail (or Outlook/custom); turn on 2-Step Verification; create App password; keep password only in env, never in repo. |
| 2. Give address to dispatch | **You** | Tell CAD dispatch: “Send incident notifications to **this address**.” |
| 3. Tell the agent the address and type | **You** | e.g. “We’re using Gmail: `cifpd.dispatch.fireultimate@gmail.com`.” |
| 4. Add email monitoring (IMAP or webhook) | **Agent** | Server (or worker) reads inbox and stores new messages; credentials in env. |
| 5. Send a test email from dispatch | **You** | Have dispatch send one real or sample message to the ingest address. |
| 6. Parse and map to incident fields | **Agent** | After we see the sample, we design the parser and auto-fill Create Incident / Incident Detail. |

---

## Summary

1. **You:** Set up one email address (e.g. Gmail), secure it with an App password, give the address to the CAD dispatch center, and tell the agent the address and that it’s Gmail (or Outlook/custom).
2. **Agent:** Add monitoring (IMAP polling or webhook) so the server receives and stores emails; credentials stay on the server only.
3. **You:** Have dispatch send a test email to that address.
4. **Agent:** Once we have the sample, we add parsing and map the content to incident fields so data flows into FireUltimate automatically.

After you have the email set up and the address given to dispatch, say so and we’ll do the monitoring step next. After the test email is received, we’ll work on deciphering and parsing it and auto-entering the correct fields.
