# Security Remediation Plan (October 2026)

**Status:** In progress on the practice branch. Not released. Do not merge.
**Created:** 2026-10-31, from the independent security audit of the practice branch.
**Progress (2026-10-31, later the same evening):** Fixes 4, 1, 2, and 3 are built and tested on this branch. Not released. Production's migration list was copied the same evening: 10 names through `20260411190000_fire_recovery_tenant_api_credentials`. This branch adds three more (`add_session`, `add_role_permission_and_account_audit`, `add_neris_report_change`). Do not promote until Crescent has an allowed sender (staging currently has 0). There is no on-screen button for that list yet.
**Working branch:** `cursor/stage-b-foundation-b5ff`. Every code fix lands here first, then goes to staging (`submenu/neris-golive-cifpd`), then to production (`main`).

Branch facts (checked 2026-10-31):
- This branch already contains everything on staging, plus 20 newer commits.
- `main` has 5 commits staging does not, but they are merge records only. There is no code difference, so the path branch → staging → `main` is clean.
- Production (`main`) already accepts CAD email today, with an older, weaker check.
- Production does not have Fire Recovery code today. It arrives with the Stage B release.

Rules for every fix:
- One fix = one small, separate commit on this branch. Unrelated fixes are never combined.
- After each fix: `npm run lint`, `npm run build`, `npm test`, then the staging check listed for that fix.
- No fix deletes department data. CAD intake and NERIS export/validation must keep working.
- Fixes 1, 2, 3, 5, 6 and 7 need no Prisma schema change.

---

## Part 1 — Hands-on items (no code)

### Do now

| # | What | Why | Done when |
|---|---|---|---|
| 1 | Change the production `admin` and `demo` passwords through the app. | Stage B makes every route require sign-in. A guessable admin password would make that sign-in useless. **This blocks the Stage B release.** | Sign-in with the new passwords works. |
| 2 | On staging: Neon backup, then clear the saved Fire Recovery password (Admin Functions → Setup/Configuration → Fire Recovery). | Staging's billing submit has no sign-in check until this branch reaches staging, and the password is stored as readable text until fix 6. The current staging value appears to be a test value last changed 2026-04-11, so this is lower urgency unless it turns out to be a working account. | The count query below returns `0`. |
| 3 | Run the read-only queries below in **both** Neon projects. Send back only counts and migration names. | Promotion applies this branch's database changes to production, and production already has some of them. | Results reviewed. |
| 4 | In Render, confirm the setting **name** `CAD_INGEST_SECRET` exists on the staging and production API services, and that the Cloudflare email Worker has its matching secret. Do not copy the values. | Production's current code accepts any CAD email if that setting is missing. | Name is present on both services. |

**Only if the saved staging value is a real, working Fire Recovery account:** ask Fire Recovery USA to change that password before Fire Recovery goes live (Stage C). The value is also in the 2026-10-28 staging backup and cannot be removed from it. Confirm whether it is real by asking whoever entered it or Fire Recovery USA, not by sending a request to Fire Recovery from staging.

Cloudflare Access in front of staging/production is **only needed if promotion of this branch is delayed**.

### Read-only queries

```sql
-- Fire Recovery passwords saved (must be 0 on staging after item 2; must stay 0 on production until Stage C is live)
SELECT COUNT(*) FROM "Tenant"
WHERE NULLIF(BTRIM("fireRecoveryApiPassword"), '') IS NOT NULL;

-- Departments that received CAD mail in the last 30 days, with how many allowed senders each has
SELECT t.slug, COUNT(DISTINCT a.id) AS allowlist_entries
FROM "Tenant" t
JOIN "CadEmailIngest" c ON c."tenantId" = t.id AND c."createdAt" > now() - interval '30 days'
LEFT JOIN "CadEmailAllowlistEntry" a ON a."tenantId" = t.id AND a.enabled
GROUP BY t.slug;

-- Passwords still stored as readable text (count only)
SELECT COUNT(*) FROM "User" WHERE "passwordHash" NOT LIKE '$2%';

-- Longest username (fix 1 limits usernames to 100 characters)
SELECT MAX(LENGTH(username)) FROM "User";

-- Departments marked suspended or archived (decides whether item D1 can wait)
SELECT status, COUNT(*) FROM "Tenant" GROUP BY status;

-- Production only: database changes production already has
SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at;
```

If the readable-text password count is above `0`, reset those accounts to strong temporary passwords before the Stage B release.

### Operator results (2026-10-31 evening, America/Chicago)

- Production `admin` password was changed on `https://cifpdil.fireultimate.app`. That site has no `demo` user. `https://demo.fireultimate.app` does not exist. Staging passwords were changed on `cifpdil.staging`, `demo.staging`, and `kankdemo.staging`.
- Staging backup was created. The Fire Recovery password was removed in the staging database. Both projects reported a saved-password count of `0`.
- Longest username: production `12`, staging `13`. Readable-text password count was reported as `0`. Staging CAD mail in the last 30 days: `cifpdil` with `0` allowed senders. Staging tenant status: trial `3`, active `2`. Production tenant status was described as active. No suspended or archived department was reported, so item D1 can wait.
- Production migration names, copied 2026-10-31 about 9:26 p.m. Chicago time. Production already has these 10, in this order: `20260306180916_init_multitenant_core`, `20260310120000_add_tenant_neris_entity_id`, `20260312180000_add_incident_table`, `20260312200000_add_cad_email_ingest`, `20260314000000_add_neris_export_history`, `20260314120000_add_neris_drafts`, `20260409140000_add_cad_parsing_settings_and_allowlist`, `20260410180000_add_cad_email_parsed_message_text`, `20260411120000_fire_recovery_incident_billing`, `20260411190000_fire_recovery_tenant_api_credentials`. The earlier "active and count 2" was the department-status result, not this list. This branch adds three that production does not have: `20261029180000_add_session`, `20261029200000_add_role_permission_and_account_audit`, `20261030180000_add_neris_report_change`. `docs/procedures/RELEASE_CHECKLIST.md` does not name individual migrations, so it did not need a correction.
- `CAD_INGEST_SECRET` name is present on the staging API, the production API, and the Cloudflare Worker. Values were not copied.

---

## Part 2 — Blocks the Stage B sign-in release

Build order: fix 4, then 1, then 2, then 3.

### Fix 1 — Failed logins can use up server memory (audit HIGH-1) — built on this branch, not released

Kept the designed limits after the operator asked on 2026-10-31. Five wrong passwords still lock the account for 15 minutes. The 10,000 cap is how many different failed names are remembered during an attack, not how many tries one person gets. Usernames over 100 characters and passwords over 256 characters are still refused. Current longest username is 12 in production and 13 on staging, so 100 does not block anyone. Passwords are not capped at 20, so a longer passphrase still works.
- **Problem:** Every failed login stores the submitted username in memory with no size limit. Request bodies may be up to 4 MB, so each request can add up to about 4 MB.
- **Affected code:** `server/auth/sessions.mjs` (`loginFailures`, `failureKey`, `loginLockStatus`, `noteLoginFailure`); `server/neris-proxy.mjs` `POST /api/auth/login`.
- **Smallest safe change (memory only, no database table):**
  1. Username over 100 characters or password over 256 characters → normal "Invalid username or password" reply; nothing stored.
  2. Cap the failed-login list at 10,000 entries. When full, remove expired entries first, then the oldest entries that are not locked.
  3. A locked account is never removed early, so flooding cannot unlock an account being guessed.
  4. If the list is full of locked accounts, new unknown usernames get "try again later" until entries expire.
- **Depends on:** approval (sign-in code); username-length query result under 100.
- **Regression risk:** Locks reset on server restart (already true today; documented). During a heavy attack, sign-in for unrecorded usernames may be refused for up to 15 minutes.
- **Automated tests (`server/auth/sessions.test.mjs`, no database needed):** long username rejected and not stored; 20,000 different failures never exceed 10,000 entries; a locked account stays locked through the flood; expired entries removed; existing tests still pass (5 failures lock, success clears).
- **Staging check:** normal sign-in works; 5 wrong passwords on a test account → "too many attempts", unlocks after 15 minutes; a 50 KB username is refused quickly; Render memory graph stays flat.

### Fix 2 — CAD intake secret only enforced when `NODE_ENV=production` (audit MEDIUM-1, part A) — built on this branch, not released
- **Affected code:** `server/neris-proxy.mjs` CAD secret check and startup warning; new `server/cad/ingestGuard.mjs`.
- **Smallest safe change:** Move the check into `ingestGuard.mjs`. With no secret configured, intake answers 503 everywhere (local development sets a test secret in `.env`). Compare with Node's timing-safe comparison. Nothing else about CAD intake changes.
- **Depends on:** Part 1 item 4.
- **Regression risk:** A service missing the secret stops CAD email with a visible 503 in the Worker logs instead of accepting unsigned mail.
- **Automated tests:** no secret → 503; wrong or missing header → 401; correct header → passes.
- **Staging check:** a real or test dispatch email still appears in CAD emails and still creates/updates the incident; a hand-sent request without the header gets 401 and adds no row.

### Fix 3 — CAD intake accepts mail with an empty sender list or unknown department (audit MEDIUM-1, part B) — built on this branch, not released

Do not deploy this until `dispatch@co.iroquois.il.us` is on Crescent's allowed-sender list. Staging reported `cifpdil` with `0` allowed senders on 2026-10-31. The app has no screen for that list yet (`GET/PATCH /api/cad/allowlist` only). Deploying first would reject real dispatch email and save nothing.
- **Affected code:** `server/neris-proxy.mjs` `cadInboundAllowlistDecision` and the department lookup in `POST /api/cad/inbound-email`.
- **Smallest safe change:** Unknown department or empty allowed-sender list → existing "rejected" reply (same status the Worker already handles, so no retries); nothing saved. Matches the 2026-10-29 decision. Existing rows are untouched.
- **Depends on:** fix 2; every department that receives CAD mail has an allowed sender **before** this reaches that environment (see Part 5).
- **Regression risk:** Dispatch email stops for a department missing an allowed sender. This is the main CAD risk; the allowlist query exists to prevent it.
- **Automated tests:** unknown department rejected; empty list rejected; matching sender passes, including `"Name <address>"`; non-matching sender rejected.
- **Staging check:** run the allowlist query first; after deploy a real dispatch email arrives and still creates the incident; an email from a personal address is rejected and adds no row.

### Fix 4 — Missing tests for core Stage B claims (tests only) — built on this branch
- **Affected code:** `server/auth/sessions.test.mjs` only.
- **Tests:** made-up or tampered session cookie refused; a session from one department refused on another department's address; a cancelled session refused; `revokeAllSessions` signs a user out everywhere; record the Origin scheme/port gap (item D5) as a known gap.
- **Depends on:** nothing (CI already provides a throwaway Postgres).
- **Regression risk:** none; no app code changes.
- **Staging check:** none; CI must pass.

---

## Part 3 — Must be fixed before Fire Recovery goes live (Stage C)

Build order: fix 5, then 6, then 7.

**Production restriction until fixes 5–7 are live in production:** do not save a Fire Recovery password in production (count must stay `0`) and do not submit bills from production.

### Fix 5 — The browser can create a fake "successful NERIS export" record (audit HIGH-3; repair plan Stage C Step 10)
- **Why it matters for billing:** Fire Recovery submit treats an incident as ready for billing when a "successful" export record exists. A fake record could get a bill sent for an incident never sent to NERIS.
- **Affected code:** `server/neris-proxy.mjs` `POST /api/neris/export`, `POST /api/neris/export-history`, and the Fire Recovery readiness check in `POST /api/fire-recovery/submit`; front end `src/api/nerisExportHistory.ts` and the export flow in `src/App.tsx`.
- **Smallest safe change:** After NERIS actually replies, the server writes the export record itself (real status, real NERIS ID, signed-in person). `POST /api/neris/export-history` then accepts only "failed" records for browser-side errors. The front end stops sending "success" records. Existing table; no schema change.
- **Depends on:** Stage B (server knows who is signed in). Server and front-end changes ship in the same deploy.
- **Regression risk:** duplicate or missing history rows if deployed separately; how reports show "Exported".
- **Automated tests:** record built from a NERIS success reply and from an error reply; a browser "success" post is refused or turned into "failed"; billing readiness only accepts server-written records.
- **Staging check:** confirm staging's `NERIS_BASE_URL` points at the NERIS test system; export one report and see one success row with the real NERIS ID; validation still works; a forced failure shows one failed row.

### Fix 6 — Fire Recovery password stored as readable text (audit HIGH-2; repair plan Stage C Step 13)
- **Verified 2026-10-31:** On a throwaway local database (no staging or production access), a signed-in admin saved the made-up password `Fake-Audit-Pw-7Q2` through `PATCH /api/fire-recovery/settings`. The `Tenant.fireRecoveryApiPassword` column then held exactly `Fake-Audit-Pw-7Q2`. The settings reply did not include it. Staging's code (`submenu/neris-golive-cifpd`) has the same save line, so the issue applies to any password entered on this branch or staging.
- **Affected code:** existing `Tenant.fireRecoveryApiPassword` column (kept); `server/neris-proxy.mjs` Fire Recovery settings `GET`/`PATCH`, submit, and billing status; new `server/crypto/secretBox.mjs`.
- **Smallest safe change:** Encrypt with AES-256-GCM before saving, tagged `enc:v1:`, key from a new Render setting `FIRE_RECOVERY_CREDENTIAL_KEY` (different key for staging and production). Settings reply returns only "a password is saved: yes/no". A readable-text value is refused with "re-enter the password" (no automatic conversion). Errors and logs never include the password or the request body. No schema change.
- **Depends on:** Part 1 item 2; approval of where the key lives (copy kept in your password manager); Fire Recovery testing with sandbox department ID `FD12345678` as decided 2026-10-29; Fire Recovery has changed the old password.
- **Regression risk:** if the key is lost or missing, billing stops until an admin re-enters the password. No department data is lost.
- **Automated tests:** encrypt/decrypt round trip; altered stored text rejected; wrong key rejected; settings reply never contains the password; a failed Fire Recovery call does not leak it; readable-text value refused.
- **Staging check:** save a password; in Neon the value starts with `enc:v1:` and does not contain the password; one sandbox submission succeeds; Render logs show no password.

### Fix 7 — Any signed-in user can read billing records (audit MEDIUM-3)
- **Affected code:** `server/auth/permissions.mjs` (permission list and route mapping); front end `src/api/fireRecovery.ts` and billing display in `src/App.tsx`.
- **Smallest safe change:** New `billing.view` permission protecting `GET /api/fire-recovery/incidents` and `GET /api/fire-recovery/incidents/:callNumber`. Front end hides billing information without it. Defaults live in code; no database change.
- **Depends on:** your choice of the default role for `billing.view` (proposed: admin).
- **Regression risk:** regular users stop seeing billing information (intended); screens must not show errors.
- **Automated tests:** route maps to `billing.view`; regular user gets 403; admin gets 200.
- **Staging check:** regular test user sees no billing information and no errors; admin sees billing as before; a department admin can lower the permission.

---

## Part 4 — Safely deferred, with restrictions

| # | Item | Restriction until fixed | When |
|---|---|---|---|
| D1 | Suspended/archived departments can still sign in (audit MEDIUM-2). | Do not rely on department status to cut off access. To cut off a department, the program owner cancels its sessions and disables its accounts. | Before any department is suspended. Moves into Part 2 if a department is already suspended or archived. |
| D2 | Report/incident data stays in the browser after a session expires (audit MEDIUM-5). | Users on shared station computers must click Sign out; shared computers use separate Windows sign-ins. | After Stage C; clearing rule needs approval first. |
| D3 | Readable-text password fallback in `verifyPassword` (audit MEDIUM-4). | Safe only while the readable-text count stays `0` in both databases. | Stage C: remove the fallback, add a test. |
| D4 | Detailed internal error messages returned to the browser (audit LOW-1). | No secrets in Render settings that could appear in error text. | Stage C. |
| D5 | Origin check ignores scheme and port (audit LOW-2). | Keep HTTPS-only at Cloudflare; session cookie is already strict and host-only. | Stage C. |
| D6 | Sign-in for an unknown username replies faster than for a real one (reveals which usernames exist). | Lockout reduces the risk. | Stage C: compare against a dummy hash when the user does not exist. |
| D7 | 12 moderate warnings in development tools only; session tests skip without a local database. | Not shipped to users; CI covers the session tests. | When convenient. |

---

## Part 5 — Release order

### Promote this branch to staging
1. Neon backup of `fireultimate-staging`.
2. Add `dispatch@co.iroquois.il.us` to Crescent's allowed-sender list on staging (admin screen).
3. Confirm `NODE_ENV=production` and `CAD_INGEST_SECRET` on the staging API service.
4. Follow `docs/procedures/RELEASE_CHECKLIST.md`.
5. Run each fix's staging check. Real CAD email must arrive; NERIS export and validation must work.

### Promote staging to production (`main`)
1. Production migration list compared on 2026-10-31. Production has the 10 names through `20260411190000_fire_recovery_tenant_api_credentials`. Apply only the three newer additions at release: Session, RolePermission plus AccountAuditLog, and NerisReportChange. The release checklist did not need a name correction. The allowed-sender SQL is still written in the release session, after the sender screen exists or the release is approved.
2. Readable-text passwords reset (if any). `admin`/`demo` passwords already changed (Part 1 item 1).
3. Neon backup of `fireultimate-prod`.
4. Apply this branch's database changes to production.
5. Add `dispatch@co.iroquois.il.us` to Crescent's allowed-sender list in the production database (exact SQL written after the migration list is reviewed). **This must happen before step 6, or real dispatch emails are rejected and lost.**
6. Deploy the code with `NODE_ENV=production`.
7. Send a test dispatch email and confirm it arrives. Confirm an unsigned request to `/api/users` returns 401.
8. Fire Recovery production restriction (Part 3) stays in force.

### Stage C
Fixes 5, 6, 7 on this branch → Fire Recovery changes the old password → staging → production → only then save the Fire Recovery password in production.

---

## Decisions needed

- Approve fix 1's memory-cap approach (instead of a database table).
- Approve fail-closed CAD intake (fixes 2 and 3).
- Approve encryption with a Render-held key (fix 6).
- Choose the default role for `billing.view` (fix 7).
- Approve the browser-clearing rule (item D2).
- Approve adding the Fire Recovery production restriction and the CAD release order (Part 5) to `docs/procedures/RELEASE_CHECKLIST.md`.
