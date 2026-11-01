# Security Remediation Plan (October 2026)

**Status:** **Stage B release BLOCKED.** Part 5 step 1 is done. On 2026-11-01, about 1:07 p.m. America/Chicago, the operator created Neon branch `backup-2026-11-01-before-stage-b` in project `fireultimate-staging` and reported **22** incidents. Leave that branch alone. Step 2 is done: on 2026-11-01, about 1:14 p.m. America/Chicago, the operator saved `dispatch@co.iroquois.il.us` for `cifpdil` on the live branch `production` (id `allow-cifpdil-dispatch-20261101`, exact email, enabled). Step 3 is done: on 2026-11-01, about 1:19 p.m. America/Chicago, the operator confirmed `Session`, `RolePermission`, `AccountAuditLog`, and `NerisReportChange` on the live staging database. Do not migrate `fireultimate-prod` or the backup branch. Step 4 is next: confirm `NODE_ENV=production` and `CAD_INGEST_SECRET` on the staging API, then promote. Do not promote until those two settings are confirmed. The Allowed Senders screen is built on this practice branch (Admin Functions → Dispatch Parsing Settings → Allowed Senders) and is not on staging. Fixes 11–14 are built on this practice branch (2026-11-01, commits `939a629`, `70ac3d5`, `aa9eba0`, `4eaed9e`). Automated tests passed: 23 tests. They are not released. The operator's click check of report `26-UPPER` passed on 2026-11-01, about 11:53 a.m. America/Chicago. Staging checks are still open. Do not rebuild fixes 8–14 or the Part 0 line. Part 0 / fix 15: **DONE.** Live on staging (PR #32) and production (PR #33). Operator verified both environments on 2026-11-01 (America/Chicago). Do not rebuild that line. Do not merge this Stage B practice branch.
**Created:** 2026-10-31, from the independent security audit of the practice branch.
**Verified:** The independent check on 2026-10-31, 10:27 p.m. America/Chicago, was against commit `a7a9413`. Later commits on this branch, through `1857c9c`, include View Exports (`25b30c1`), the Part 0 key check (`ba777be`), and fixes 8–10. Those later commits were not part of that October 31 check. The operator finished the practice-site click checks for fixes 8, 9, and 10 on 2026-11-01, about 11:30 a.m. America/Chicago, and reported no issues. Staging checks for those fixes stay open until this branch is deployed.
**Progress (2026-11-01, America/Chicago):** Part 1 is complete. Part 0 / fix 15 is **fully done** on staging and production. Part 2 code (fixes 1–4 and 8–14) is built and automated tests passed. The operator's practice-site click checks for fixes 8–10 passed, and the `26-UPPER` report check passed on 2026-11-01, about 11:53 a.m. America/Chicago. Nothing in Part 2 is released. Staging checks are open. Part 3 code (fixes 5, 6, and 7) is built and not released. Follow-ups 5a and 5b are fix 16, Stage C, and are not built. The operator chose the recommended path: fix 13 treats HEAD as a normal read, fix 16 stays unbuilt, and fix 17 stays as the 15-minute lock with no code change. Staging and production both verified on 2026-11-01: admin path case variants returned 403, sign-in worked. Staging CAD mail to **`cifpdil@cad.fireultimate.app`** arrived while the Worker pointed at staging. Render log search is optional and often empty; treat Raw Email / Neon as the CAD proof. Part 4 is deferred. Crescent CAD mailbox (the To address) is **`cifpdil@cad.fireultimate.app`**. The Allowed Senders screen is built on this practice branch and is not on staging yet. It lives at Admin Functions → Dispatch Parsing Settings → Allowed Senders. An empty list still accepts no one. Staging does not have the screen until this branch is promoted. Crescent's From address `dispatch@co.iroquois.il.us` was saved on the live staging branch on 2026-11-01, about 1:14 p.m. America/Chicago (exact email, enabled, id `allow-cifpdil-dispatch-20261101`). Do not create the Render setting `FIRE_RECOVERY_CREDENTIAL_KEY` in a coding session. Do not save a Fire Recovery password in production until fixes 5–7 are live there. Do not release this branch until that sender is saved, because an empty sender list now rejects mail. Do not merge.
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

## Part 0 — Urgent: platform admin key can be skipped (was live on production and staging)

**Code status: DONE on the live branches.** Practice-branch line remains at `ba777be`. Live copies: staging PR #32 merged (`fedb881` on `submenu/neris-golive-cifpd`); production PR #33 merged (`fae804a` on `main`). Operator verified staging and production on 2026-11-01 (America/Chicago).

- **Problem:** The program-owner tools under `/api/admin/` require the platform admin key. The check only looks at paths that start with lowercase `/api/admin` (`requirePlatformAdmin`, `server/neris-proxy.mjs` line 1554 on this branch; line 1618 on `main`; line 1633 on staging). Express matches routes regardless of letter case, so `/API/admin/...` reaches the same tools with no key.
- **What someone could do on a live server:** create a new department with an admin password they choose (`POST /api/admin/tenants`), attach a web address to any existing department (`POST /api/admin/tenants/:tenantId/domains`), or refresh the NERIS directory. These routes run before the department is looked up, so they work on any address that reaches the server, including the direct Render address.
- **Verified:** only on a throwaway local database. With no key, `POST /API/admin/tenants/<Crescent id>/domains` attached a new web address to Crescent. Nothing was sent to staging or production.

### Step 1 — Check now (read-only, both Neon projects) — completed 2026-11-01

The operator ran both queries. Production slugs and hostnames were all recognized. Staging had two unfamiliar rows: slug `local2` with hostname `local2.localhost`, and slug `wave2test` with hostname `wave2test.staging.fireultimate.app`. Those names match old test departments in `docs/seed-and-tenant-reference.md` and the March 6, 2026 notes. They were left in place. Render logs for the staging API and the production API, searched 14 days for `/api` and `/API`, showed no matching lines.

```sql
-- Departments, newest first. Look for any you do not recognize.
SELECT slug, name, status, "createdAt" FROM "Tenant" ORDER BY "createdAt" DESC;

-- Web addresses, newest first. Look for any you did not add.
SELECT d.hostname, t.slug, d."createdAt"
FROM "TenantDomain" d JOIN "Tenant" t ON t.id = d."tenantId"
ORDER BY d."createdAt" DESC;
```

Also search the Render logs for both API services for request paths that contain `/API` or any other capital letters in `/api`.

### Step 2 — Emergency fix (operator approved 2026-11-01; built on this branch, not released)
- **Smallest safe change:** make the admin-key check compare a lowercase copy of the path, so `/API/admin/...` needs the key too. One line in `requirePlatformAdmin`, plus one automated test. Built here. It still has to be applied to `main` and staging as a separate small change, independent of Stage B. Do not merge pull request 31 to do that.
- **Not enough on its own:** a Cloudflare rule blocking `/api` paths with capital letters protects only the custom domains. The direct Render address does not pass through Cloudflare, and the CAD Worker uses that address.
- **Staging check:** `POST /API/admin/tenants` with no key returns 403; CAD email still arrives; normal sign-in still works.

---

## Part 1 — Hands-on items (no code)

**Status: completed 2026-10-31 (America/Chicago).** Reviewed the same evening. Nothing in this part is still waiting on the operator. Cloudflare Access is still only needed if a planned promotion of this branch is delayed. Asking Fire Recovery USA to change a password is not required: the operator said the staging value was a test password, and both databases now report `0`.

| # | What | Result |
|---|---|---|
| 1 | Change the production `admin` and `demo` passwords through the app. | **Completed.** Production `admin` was changed on `https://cifpdil.fireultimate.app`. That site has no `demo` user, and `https://demo.fireultimate.app` does not exist, so there is no production `demo` password to change. Staging passwords were changed on `cifpdil`, `demo`, and `kankdemo`. |
| 2 | On staging: Neon backup, then clear the saved Fire Recovery password. | **Completed.** Backup was created. The test password was removed. The count query is `0` on staging and on production. |
| 3 | Run the read-only queries in both Neon projects. | **Completed.** Results are recorded below. Longest username is 12 in production and 13 on staging, both under the 100-character sign-in cap. Readable-text password count is `0`. No suspended or archived department was reported. Production has the 10 migration names through `20260411190000_fire_recovery_tenant_api_credentials`. |
| 4 | Confirm the setting name `CAD_INGEST_SECRET` on the staging API, the production API, and the Cloudflare Worker. | **Completed.** The name is present in all three places. The values were not copied. |

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

**Code status: fixes 1–4 and 8–10 are built on this branch. Not released.** Build order was fix 4, then 1, then 2, then 3, then 8, then 9, then 10. Automated tests passed. Staging checks are still open because this branch has not been deployed.

The operator has no Part 2 clicks until a release day. The allowed-sender screen was parked as Stage D, step 23, on October 31, and was then built on this practice branch on 2026-11-01 before the staging release. It is not on staging yet. On 2026-10-31 staging reported `cifpdil` with 0 allowed senders. On 2026-11-01, about 1:14 p.m. America/Chicago, the operator saved `dispatch@co.iroquois.il.us` as an enabled exact sender on the live staging branch. Do not delete that row.

### Fix 1 — Failed logins can use up server memory (audit HIGH-1) — built on this branch, not released

**Verification 2026-10-31: PARTIALLY FIXED.** Memory is now capped (20,000 failed names left exactly 10,000 entries; a 60 KB username was refused and nothing was stored). But flooding can still reset an account's failure count before it locks, and counts below 5 never expire. See fix 9.

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

**Verification 2026-10-31: VERIFIED FIXED (local).** Missing or wrong header returned 401 and saved nothing. Unit tests cover the 503 when no secret is configured.
- **Affected code:** `server/neris-proxy.mjs` CAD secret check and startup warning; new `server/cad/ingestGuard.mjs`.
- **Smallest safe change:** Move the check into `ingestGuard.mjs`. With no secret configured, intake answers 503 everywhere (local development sets a test secret in `.env`). Compare with Node's timing-safe comparison. Nothing else about CAD intake changes.
- **Depends on:** Part 1 item 4.
- **Regression risk:** A service missing the secret stops CAD email with a visible 503 in the Worker logs instead of accepting unsigned mail.
- **Automated tests:** no secret → 503; wrong or missing header → 401; correct header → passes.
- **Staging check:** a real or test dispatch email still appears in CAD emails and still creates/updates the incident; a hand-sent request without the header gets 401 and adds no row.

### Fix 3 — CAD intake accepts mail with an empty sender list or unknown department (audit MEDIUM-1, part B) — built on this branch, not released

**Verification 2026-10-31: VERIFIED FIXED (local).** Unknown department and empty sender list were rejected with nothing saved. An allowed sender in `"County CAD <dispatch@co.iroquois.il.us>"` form was saved under the right department. A different sender was rejected.

Do not deploy this until `dispatch@co.iroquois.il.us` is on Crescent's allowed-sender list. Staging reported `cifpdil` with `0` allowed senders on 2026-10-31. The practice branch now has the Allowed Senders screen. Staging's current site does not. Deploying first would reject real dispatch email and save nothing.
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

**Verification 2026-10-31:** passed locally against a throwaway Postgres. Live checks also confirmed sign-out, the 60-minute idle limit, tampered cookies, and another department's cookie are all refused. Missing: tests for letter-case and trailing-slash variants (fix 8).

### Fix 8 — Letter case and trailing slashes skip sign-in and permissions (found in verification; CRITICAL and HIGH) — built on this branch, not released

Built in commit `019f06d`. The "Verified locally" bullets below are the 2026-10-31 evidence from before this fix. After the fix, those paths return 404 or 403 and do not return data. Do not rebuild this fix.
- **Problem:** Express matches routes regardless of letter case and accepts a trailing slash. The sign-in gate only checks paths that start with lowercase `/api` (`server/neris-proxy.mjs` lines 1755 and 1760). The permission lookup compares the exact path (`server/auth/permissions.mjs` line 53).
- **Verified locally, no session at all:** `GET /API/users`, `/API/account-audit`, `/API/department-details`, `/API/cad/emails`, and `/aPi/users` returned data. `POST /API/incidents` created an incident. `PATCH /API/fire-recovery/settings` changed settings. Account create, rename, and delete still refused, because those handlers check the signed-in person themselves. Another department's data could not be reached this way.
- **Verified locally, regular signed-in user:** `GET /api/fire-recovery/incidents/` (trailing slash) returned 200. `POST /api/users/` created an account. `PATCH /api/fire-recovery/settings/` changed settings. `POST /api/neris/export/` and `POST /api/fire-recovery/submit/` reached the admin-only handlers. The new `GET /api/neris/export-history` rule from commit `25b30c1` uses the same exact-path check, so it is expected to have the same gap.
- **Affected code:** `server/neris-proxy.mjs` (app setup at line 80, the sign-in gate, the permission middleware); `server/auth/permissions.mjs` (`permissionForRequest`).
- **Smallest safe change:**
  1. Turn on Express's `case sensitive routing` and `strict routing` right after the app is created, so `/API/...` and `/api/users/` no longer reach any handler.
  2. As a second layer, make the sign-in gate treat any path whose lowercase form starts with `/api` as an API request.
  3. Make `permissionForRequest` strip one trailing slash before comparing.
- **Depends on:** operator approval (authorization code). Before step 1, confirm the front end never calls an API path with a trailing slash or capital letters.
- **Regression risk:** a front-end call with a trailing slash would start failing with 404. A non-API capitalized path such as `/API/users` would fall through to the web page instead of data.
- **Automated tests:** loop over every API route and request it with an uppercase prefix, mixed case, and a trailing slash. With no session, each must return 401 or 404 and never data. As a regular user, each admin-only route must return 403 or 404. Include `/api/admin/...` with no key (Part 0).
- **Staging check:** the same variants against staging with a test account. Normal pages, NERIS export, and CAD intake still work.

### Fix 9 — Flooding resets the login lockout; old failures never expire (found in verification; MEDIUM and LOW) — built on this branch, not released
- **Problem:** When the failed-login list is full, the oldest unlocked row is removed. An attacker can make 4 guesses, send 10,000 junk usernames (cheap, because unknown names skip the password check), and repeat. The local probe made 13 guesses on one account without a lock. Separately, counts below 5 never expire: 4 mistakes a year ago plus 1 today locks the account.
- **Affected code:** `server/auth/sessions.mjs` (`noteLoginFailure`, `evictOldestUnlockedLoginFailure`, `sweepExpiredLoginFailures`).
- **Smallest safe change:** Expire a failure count 15 minutes after its last failure. When the list is full, remove only rows for usernames that do not exist, or rows with expired counts. Never remove a row for a real account that has failures. Respond "try again later" if no room can be made.
- **Depends on:** operator approval (sign-in code). Fix 8 first.
- **Regression risk:** during a large flood, sign-in for new usernames may get "try again later" until rows expire.
- **Automated tests:** a real account with 4 failures keeps its count through a 20,000-name flood; the 5th failure locks it; a count older than 15 minutes is cleared; memory stays capped.
- **Staging check:** the same as fix 1.

### Fix 10 — Error replies expose internal details (audit LOW-1, moved up from item D4) — built on this branch, not released
- **Problem:** 49 server replies still return the raw internal error message. Badly formed JSON returns an HTML page with a stack trace and server file paths when `NODE_ENV` is not `production`.
- **Smallest safe change:** Add one JSON error handler at the end of the server that returns a short, fixed message and logs the detail on the server. Set `NODE_ENV=production` on both Render services at release (already in Part 5).
- **Depends on:** nothing.
- **Regression risk:** some screens may show a less specific message.
- **Automated tests:** badly formed JSON returns JSON with no stack trace and no file path.
- **Staging check:** send badly formed JSON to one route; the reply has no file path.

---

## Part 2B — Next agent: fixes from the November 1 verification

**Status: fixes 11–14 are built on this practice branch and not released.** The operator approved the recommended choices on 2026-11-01. Commits: fix 11 `939a629`, fix 12 `70ac3d5`, fix 13 `aa9eba0`, fix 14 `4eaed9e`. `npm test` passed with 23 tests. Do not rebuild them. Fix 13 treats HEAD as GET. Fix 15 is fully done on staging and production. Fix 16 stays unbuilt (Stage C). Fix 17 stays as the current 15-minute lock, with no code change. The November 1 verification section below is the record of what was found before fixes 11–14.

### Before you start (next agent)
1. Read `cursoragent-context.md`, `docs/task-2-multitenant-domain-plan.md`, `.cursor/project-context.md`, and this file. Restate the task, the constraints, and the acceptance checks to the user.
2. Get the user's approval before you edit `server/neris-proxy.mjs` or `server/auth/permissions.mjs`. Both hold authorization code. No fix in this part changes the Prisma schema or a migration. If a fix starts to need one, stop and ask.
3. Stay on `cursor/stage-b-foundation-b5ff`. Do not open a new branch for fixes 11–14 and 16–17. Fix 15 is already done on its own live branches.
4. Run `git pull origin cursor/stage-b-foundation-b5ff`. The code these steps were written against is `1857c9c`. Line numbers below are from that commit. Search for the quoted code if they have moved.
5. Start a throwaway local Postgres for the tests. `npm test` accepts only `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable`. Never point tests at Neon.
6. Build order: 11, 12, 13, 14. Then 16 if approved. Then 17 if approved. One commit per fix. After each fix run `npm run lint`, `npm run build`, and `npm test`, and fix anything that fails before you move on.

### Fix 11 — Capital letters in a call number or ID now give "Not found" (HIGH, regression from fix 8) — Stage B blocker
- **Problem:** The sign-in gate compares the request path with `canonicalApiPath(path)`, and that function lowercases the **whole** path, including the call number or ID at the end. Any path that holds a capital letter gets `404 {"ok":false,"message":"Not found."}` before it reaches its handler. That covers every route with a `:callNumber` or `:id` value that contains a capital letter.
- **Evidence (local, 2026-11-01):** As an admin, `GET /api/neris/drafts/26-RECEIPT`, `GET /api/neris/drafts/26-RECEIPT/history`, and `GET /api/fire-recovery/incidents/26-RECEIPT` all returned the generic 404. The same requests with `26-receipt` reached the handlers.
- **Who is affected:** Incident IDs and user IDs are lowercase database IDs, so those routes are not affected today. NERIS drafts and Fire Recovery billing rows use the call number. A department whose call numbers contain a letter (for example `26-FD0012`) cannot open, save, unlock, delete, or view the history of that report, and cannot read its billing row.
- **Affected code:** `server/neris-proxy.mjs`, `canonicalApiPath` (lines 1556–1561), used once by the sign-in gate (lines 1766–1776). Nothing else calls it.
- **Smallest safe change:** Lowercase only the `/api` prefix check. Keep the rest of the path exactly as it was sent:

```js
/** API path with one trailing slash removed. Empty when the path is not under /api. Letters after /api keep their case. */
function canonicalApiPath(path) {
  const exact = String(path || "").split("?")[0];
  if (!exact.toLowerCase().startsWith("/api")) return "";
  const trimmed = exact.length > 1 && exact.endsWith("/") ? exact.slice(0, -1) : exact;
  return `/api${trimmed.slice(4)}`;
}
```

  After this change, `exactPath !== canonical` is true only when the prefix is not exactly lowercase `/api` (for example `/API/users` or `/aPi/users`) or when the path ends in `/`. Both still get the 404.
- **Why this stays safe:** A capital letter in a fixed part of the path, such as `/api/Users` or `/api/Fire-Recovery/incidents`, now passes the gate. It still needs a session (401 without one). It cannot reach a handler, because `case sensitive routing` (line 82) stays on. For a signed-in user, `permissionForRequest` returns no permission for that spelling, but there is no handler for it either, so nothing is read or changed. Do not turn off `case sensitive routing` or `strict routing`. Do not change `requirePlatformAdmin` (line 1565); it already lowercases.
- **Optional, same commit:** any API path that no route matches currently gets Express's default HTML "Cannot GET" page. To return JSON instead, add this just before the final error handler (line 6093):

```js
app.use((request, response, next) => {
  if (!String(request.path || "").toLowerCase().startsWith("/api")) {
    next();
    return;
  }
  response.status(404).json({ ok: false, message: "Not found." });
});
```

  The front-end catch-all at line 6084 already skips `/api` paths, so this does not affect pages.
- **Depends on:** user approval (sign-in gate code). Nothing else.
- **Regression risk:** low. One function. The danger is going too far, for example lowercasing the path somewhere else or removing the prefix check. The tests below catch both.
- **Automated tests (`server/auth/sessions.test.mjs`):**
  1. In the route loop (lines 266–300), change the placeholder from `"missing"` to `"MiXeD-1"`: `pattern.replace(/:[A-Za-z0-9_]+/g, "MiXeD-1")`. Signed out, every exact path must still return 401 with `AUTH_REQUIRED`. Every `/API`, `/aPi`, and trailing-slash variant must still return 401 or 404, and `/api/admin` variants 403.
  2. Add a fourth variant that capitalizes the first fixed word after `/api` (for example `/api/USERS`, `/api/NERIS/drafts/MiXeD-1`). Signed out, it must be 401 or 404 and never `ok: true`.
  3. Add a positive check, signed in as the admin (`first.pair`): `PATCH /api/neris/drafts/26-UPPER` with `{ payload: { reportStatus: "Draft", formValues: {} } }` returns 200. `GET /api/neris/drafts/26-UPPER` returns 200. `GET /api/neris/drafts/26-UPPER/history` returns 200. `GET /api/fire-recovery/incidents/26-UPPER` returns 404 with the message `Fire Recovery row not found for this incident.` (the handler's own message, not `Not found.`). Copy the request style from the draft test at line 642.
  4. Signed in as the regular user (`ffCookie.pair`): `GET /api/Fire-Recovery/incidents`, `GET /api/fire-recovery/incidents/`, and `GET /API/fire-recovery/incidents` must each return 403 or 404, and never `ok: true`. Do the same for `GET /api/Users` and `GET /api/Account-Audit`.
- **Staging check (after promotion, test account only):** open a report whose call number contains a capital letter; it loads and saves. Signed out, `/API/users` returns 404 and `/api/users` returns 401.

### Fix 12 — A badly formed request body is written to the server log (MEDIUM) — Stage B blocker
- **Problem:** The final error handler (line 6098) runs `console.error(error)`. When JSON cannot be read, Express puts the raw request text on `error.body`, so the whole body is printed in the Render log. A login or Fire Recovery settings request with one broken character would log the password in readable text.
- **Evidence (local, 2026-11-01):** A malformed `PATCH /api/fire-recovery/settings` body holding a made-up Fire Recovery password showed up word for word in the server output.
- **Affected code:** `server/neris-proxy.mjs`, final error handler (lines 6093–6104). Leave the reply it sends unchanged.
- **Smallest safe change:** Log a short fixed summary. Never log the body, the headers, the cookie, or the error object:

```js
app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  const unreadable = error?.type === "entity.parse.failed" || error instanceof SyntaxError;
  const status = unreadable ? 400 : 500;
  console.error("[request error]", {
    method: request.method,
    path: String(request.path || "").slice(0, 200),
    status,
    type: typeof error?.type === "string" ? error.type : error?.name || "Error",
  });
  response.status(status).json({
    ok: false,
    message: unreadable ? "The request could not be read." : "Something went wrong.",
  });
});
```

  Do not log `error.message` here. For a parse error it can quote part of the body.
- **Also search for the same pattern elsewhere:** `rg -n "console\.(error|log|warn)\(" server/neris-proxy.mjs`. Any call that passes `request.body`, a whole `error` object from a route that reads passwords, or `request.headers` should log a fixed text plus the route name instead. Do not change log lines that print only fixed text.
- **Depends on:** nothing. Can be built before fix 11 if the user prefers.
- **Regression risk:** less detail in the logs when debugging a 500. The method, path, and error type stay.
- **Automated tests (`server/auth/sessions.test.mjs`, next to the bad-JSON test at lines 1490–1527):** replace `console.error` with a function that saves its arguments, for the length of one request, and restore it in `finally`. Send `{"username":"chief","password":"Fake-Log-Secret-9X` (broken on purpose) to `/api/auth/login`. Assert the reply is still 400 with `The request could not be read.` Assert that no saved log line contains `Fake-Log-Secret-9X`, using `JSON.stringify` plus `util.inspect` of every argument. Repeat with a broken body on `PATCH /api/fire-recovery/settings`, signed in as the admin.
- **Staging check:** send one broken JSON body with a made-up value to `/api/auth/login`. Search the staging API's Render log for that value; it must not be there.

### Fix 13 — A HEAD request skips the permission check (LOW) — Stage B blocker
- **Problem:** Express answers a `HEAD` request with the matching `GET` handler and drops only the body. `permissionForRequest` checks `verb === "GET"`, so `HEAD` gets no permission at all. A signed-in regular user can send `HEAD` to admin-only list routes. The reply has no body, but its status and `Content-Length` show whether a record exists and roughly how large the list is.
- **Evidence (local, 2026-11-01):** A regular user's `HEAD /api/fire-recovery/incidents`, `/api/account-audit`, `/api/neris/export-history`, and `/api/cad/emails` returned 200 with a length. `HEAD` on an existing billing row returned 200 with length 437. A missing row returned 404.
- **Affected code:** `server/auth/permissions.mjs`, `permissionForRequest` (line 52). `server/neris-proxy.mjs`, the sign-in gate's public-route lookup (line 1782).
- **Smallest safe change (recommended):** treat `HEAD` as `GET` for the permission lookup and the public-route lookup:

```js
// server/auth/permissions.mjs, first line of permissionForRequest
const upper = String(method || "").toUpperCase();
const verb = upper === "HEAD" ? "GET" : upper;
```

```js
// server/neris-proxy.mjs, sign-in gate
const routeMethod = request.method === "HEAD" ? "GET" : request.method;
const routeKey = `${routeMethod} ${exactPath}`;
```

  `isSelfNameOnlyUserPatch` needs no change; it only allows `PATCH`.
- **Alternative (also safe):** in the sign-in gate, answer `HEAD` on any API path with `405 {"ok":false,"message":"Method not allowed."}` and an `Allow: GET` header. Use this only if the user prefers it. Before choosing it, check the Render health-check setting for both API services; if either uses `HEAD` on an `/api` path, choose the recommended change instead.
- **Depends on:** user approval (permission code). Build after fix 11.
- **Regression risk:** very low. No page in the app sends `HEAD`.
- **Automated tests:** in the route loop, for every `GET` route also send `HEAD` signed out and expect 401. In the regular-user section, send `HEAD` to `/api/fire-recovery/incidents`, `/api/fire-recovery/incidents/<an existing call number>`, `/api/account-audit`, `/api/neris/export-history`, and `/api/cad/emails`, and expect 403 each time. As the admin, `HEAD /api/fire-recovery/incidents` returns 200. The test helper `call` must allow an empty body for `HEAD`; check that it does not try to read JSON from an empty reply.
- **Staging check:** with a regular test account, `curl -I` (which sends `HEAD`) to `/api/account-audit` with that account's cookie returns 403.

### Fix 14 — 49 routes still send the internal error text to the browser (LOW-1, the rest of fix 10) — Stage B blocker
- **Problem:** Fix 10 added a safe final handler, but 49 route `catch` blocks still reply with `error instanceof Error ? error.message : "…"`. When the database is down or a query fails, the browser receives the raw Prisma text, which can include table names, the database host, and its port.
- **Evidence (local, 2026-11-01):** with the database stopped, `GET /api/users` as an admin returned the raw Prisma message including `127.0.0.1:5432`.
- **Affected code:** `server/neris-proxy.mjs`, lines 1659, 1698, 1757, 1818, 1854, 1918, 1935, 1975, 2004, 2340, 2383, 2438, 2542, 2570, 2658, 2741, 2784, 2808, 2872, 2936, 3071, 3142, 3365, 3394, 3427, 3500, 3555, 3600, 3650, 3714, 3765, 3788, 3888, 3987, 4016, 4409, 4468, 4982, 5050, 5183, 5246, 5296, 5326, 5366, 5385, 5453, 5644, 5897, and 6069. Find them again with `rg -n "error instanceof Error \? error.message" server/neris-proxy.mjs`.
- **Smallest safe change (an allow-list, not a block-list):**
  1. Add a small helper near the top of `server/neris-proxy.mjs`:

```js
/** Errors whose message is written for the person using the app. */
class PublicError extends Error {}

/** Message safe to send to the browser. Anything not marked public gets the fixed fallback. */
function publicErrorMessage(error, fallback) {
  if (error instanceof PublicError) return error.message;
  console.error("[route error]", { name: error?.name || "Error", code: error?.code || "" });
  return fallback;
}
```

  2. In each of the 49 `catch` blocks, replace `error instanceof Error ? error.message : "X"` with `publicErrorMessage(error, "X")`. Keep each route's own fallback text and status code.
  3. Mark only messages written for people as public. Change `throw new Error(` to `throw new PublicError(` at `server/neris-proxy.mjs` lines 796, 801, 845, 853, 860, 864 (NERIS sign-in messages), and 1110, 1115, 1124, 1127, 1130 (report checks such as "Missing incident number."). Do the same in `server/cadDispatchRuleEngine.mjs` (rule checks such as "Rules must be an array.") by exporting `PublicError` from a tiny shared file, for example `server/http/publicError.mjs`, and importing it in both places. Before marking a message public, read it and confirm it holds no secret, URL with a key, or database detail.
  4. Leave the Fire Recovery replies as they are: line 3788 already passes through `scrubSecret`. Leave every reply that sends a fixed text (for example `"Missing tenant context."`) unchanged.
  5. Do not change the sign-in gate's `catch` (line 1818) to send detail. It becomes `publicErrorMessage(error, "Sign-in check failed.")`.
- **Depends on:** fix 12 (so the new log lines follow the same no-body rule).
- **Regression risk:** medium. A screen that used to show a useful message may now show the fallback. The main ones to check are NERIS export and validate (NERIS sign-in problems), CAD rule save (rule errors), and the admin tenant tools. Click each of those after the change.
- **Automated tests:**
  1. Unit test (new file `server/http/publicError.test.mjs`, added to the `npm test` list in `package.json`): a `PublicError` message passes through; a plain `Error("Invalid prisma.user.findMany() invocation … 127.0.0.1:5432")` returns the fallback.
  2. Integration test in `server/auth/sessions.test.mjs`: temporarily replace one Prisma method used by `GET /api/users` (for example `prisma.user.findMany`) with a function that throws `new Error("Invalid prisma call at 127.0.0.1:5432")`, call the route as the admin, restore the method in `finally`, and assert the reply has no `prisma` (any letter case) and no `127.0.0.1`.
  3. Keep the existing NERIS and CAD rule tests passing; they show that public messages still reach the screen.
- **Staging check:** none that is safe to force. Confirm a normal NERIS validation error and a CAD rule mistake still show a readable message.

### Fix 15 — Put the Part 0 admin-key line on `main` and staging (operational) — DONE
- **Status (2026-11-01, America/Chicago):** **Fully done.** Staging Parts A–D passed. Production Part E passed.
- **Branches / PRs:** staging `cursor/admin-key-case-staging-44c8` → PR #32 merged into `submenu/neris-golive-cifpd` (`fedb881`). Production `cursor/admin-key-case-main-44c8` → PR #33 merged into `main` (`fae804a`). Each changed only `requirePlatformAdmin` to `request.path.toLowerCase().startsWith("/api/admin")`.
- **Staging operator result:** `/api/admin`, `/API/admin`, and `/api/Admin` returned 403 without a key. Staging sign-in worked. CAD Worker pointed at staging and received mail to **`cifpdil@cad.fireultimate.app`** with no issue. Render Logs search found no matching lines; that is a known weak check. Prefer **Raw Email** or Neon.
- **Production operator result:** Part E passed — production 403 checks and sign-in succeeded. Production CAD email test was correctly skipped while the Worker still pointed at staging.
- **CAD address source of truth:** **`cifpdil@cad.fireultimate.app`**.

### Fix 16 — NERIS export record follow-ups (5a and 5b) — Stage C, not a Stage B blocker
- **5a correction (2026-11-01):** the October 31 verification said the browser used to fill in the validator name. That was wrong. At the original audit commit `7e6b991`, the browser also passed `""` for the validator name (`appendExportHistoryRecord(exportResult, "", statusForHistory)`). The blank value is not a regression. Only build this if the user wants a validator name recorded.
  - **If approved:** the browser sends `validatorName` inside the `POST /api/neris/export` body (`src/pages/NerisReportFormPage.tsx`, where the export request body is built from `buildExportRequestConfig`). The server stores `String(trimValue(body.validatorName) ?? "").slice(0, 200)` instead of `""` at line 3014 of `server/neris-proxy.mjs`. The value is display-only and must never affect billing readiness. Test: an export with `validatorName: "Lt Smith"` stores `Lt Smith`; a 5,000-character value is cut to 200.
- **5b (re-export before billing):** success records written before fix 5 lack the server mark and no longer count for billing. Do not write code to "upgrade" old rows; that would bring back the forgery fix 5 closed. Instead, on staging, export one already-exported test incident a second time and record how NERIS answers (update or duplicate). Write the answer here. If NERIS updates cleanly, the Stage C release note tells billing staff to re-export before submitting. If it duplicates, stop and ask the user.

### Fix 17 — Anyone can lock a real account with five wrong passwords (LOW; decision needed) — not a Stage B blocker
- **Problem:** fix 9 made the lock reliable, which also means anyone who knows a username can lock it for 15 minutes, again and again. There is no admin unlock other than restarting the server.
- **Evidence (local, 2026-11-01):** five wrong passwords locked a known account. The correct password was then refused for 15 minutes.
- **Why it is not simple:** a per-address limit needs the real visitor address, but `TRUST_PROXY` stays unset on Render, so the server sees the proxy's address, not the visitor's. Do not set `TRUST_PROXY` to solve this.
- **Options for the user to choose (do not build without a choice):**
  1. **Keep as is (recommended for Stage B).** Document it. Restriction: if an account is being locked on purpose, the program owner restarts the API service, and a Cloudflare rate-limit rule is added on `/api/auth/login`.
  2. **Admin unlock button.** A department admin clears one user's lock. Small code change in `server/auth/sessions.mjs` (export a `clearLoginLock(tenantId, username)`) plus one admin route protected by `users.manage`. No schema change.
  3. **Slow down instead of lock.** After five failures, each further attempt waits longer, up to 30 seconds, instead of a hard lock. Bigger change to the lockout tests.
- **Tests for option 2 if chosen:** locked account → admin clears it → the correct password works; a regular user gets 403 on the clear route; a different department's admin cannot clear it.

### Still deferred (unchanged by the November 1 verification)
D1 (suspended departments), D2 (browser cache after expiry), D3 (readable-text password fallback in `verifyPassword`, lines 236–239), D5 (Origin scheme and port), D6 (login timing), and D7 (development warnings) stay in Part 4 with the same restrictions. D3's condition was re-checked: the operator reported the readable-text count as `0` in both databases.

### Done means (for the next agent to report)
- Fixes 11–14 are committed one at a time on `cursor/stage-b-foundation-b5ff`, each with its tests.
- `npm run lint`, `npm run build`, and `npm test` pass after the last commit. Report the test count.
- A local check, signed in as the admin, shows a report with call number `26-UPPER` opens and saves.
- A local check shows a broken JSON body with a made-up secret does not appear in the server output.
- A local check shows a regular user's `HEAD /api/account-audit` returns 403.
- A local check with the database stopped shows `GET /api/users` returns a fixed message with no `prisma` and no `127.0.0.1`.
- This file's Status and Progress lines are updated. Fixes 15–17 are listed as still open unless the user approved them.
- Release prerequisites are unchanged and still open: `dispatch@co.iroquois.il.us` saved for Crescent, `FIRE_RECOVERY_CREDENTIAL_KEY` created on Render by the operator (not in a coding session), and `NODE_ENV=production` on both API services at release.

---

## Part 3 — Must be fixed before Fire Recovery goes live (Stage C)

Build order: fix 5, then 6, then 7. All three are built on this practice branch and not released.

**Production restriction until fixes 5–7 are live in production:** do not save a Fire Recovery password in production (count must stay `0`) and do not submit bills from production.

### Fix 5 — The browser can create a fake "successful NERIS export" record (audit HIGH-3; repair plan Stage C Step 10) — built on this branch, not released
- **Why it matters for billing:** Fire Recovery submit treats an incident as ready for billing when a "successful" export record exists. A fake record could get a bill sent for an incident never sent to NERIS.
- **Affected code:** `server/neris-proxy.mjs` `POST /api/neris/export`, `POST /api/neris/export-history`, and the Fire Recovery readiness check in `POST /api/fire-recovery/submit`; front end `src/api/nerisExportHistory.ts` and the export flow in `src/App.tsx`.
- **Smallest safe change:** After NERIS actually replies, the server writes the export record itself (real status, real NERIS ID, signed-in person). `POST /api/neris/export-history` then accepts only "failed" records for browser-side errors. The front end stops sending "success" records. Existing table; no schema change.
- **Depends on:** Stage B (server knows who is signed in). Server and front-end changes ship in the same deploy.
- **Regression risk:** duplicate or missing history rows if deployed separately; how reports show "Exported".
- **Automated tests:** record built from a NERIS success reply and from an error reply; a browser "success" post is refused or turned into "failed"; billing readiness only accepts server-written records.
- **Staging check:** confirm staging's `NERIS_BASE_URL` points at the NERIS test system; export one report and see one success row with the real NERIS ID; validation still works; a forced failure shows one failed row.

**Verification 2026-10-31: VERIFIED FIXED (local and automated tests).** A browser "success" post returned 400. The automated test fakes NERIS success and error replies, and a planted fake record was not accepted for billing. Two follow-ups:
- **5a — Validator name is blank** on export records (`validatorName: ""`, `server/neris-proxy.mjs` line 3014). Corrected 2026-11-01: the browser also sent a blank value before fix 5, so this is not a regression. Optional; see fix 16.
- **5b — Earlier exports no longer count for billing.** Success records written before this change lack the server mark, so those incidents must be exported to NERIS again before billing. On staging, confirm how NERIS answers a second export of the same incident before relying on this.

### Fix 6 — Fire Recovery password stored as readable text (audit HIGH-2; repair plan Stage C Step 13) — built on this branch, not released
- **Verified 2026-10-31:** On a throwaway local database (no staging or production access), a signed-in admin saved the made-up password `Fake-Audit-Pw-7Q2` through `PATCH /api/fire-recovery/settings`. The `Tenant.fireRecoveryApiPassword` column then held exactly `Fake-Audit-Pw-7Q2`. The settings reply did not include it. Staging's code (`submenu/neris-golive-cifpd`) has the same save line, so the issue applies to any password entered on this branch or staging.
- **Affected code:** existing `Tenant.fireRecoveryApiPassword` column (kept); `server/neris-proxy.mjs` Fire Recovery settings `GET`/`PATCH`, submit, and billing status; new `server/crypto/secretBox.mjs`.
- **Smallest safe change:** Encrypt with AES-256-GCM before saving, tagged `enc:v1:`, key from a new Render setting `FIRE_RECOVERY_CREDENTIAL_KEY` (different key for staging and production). Settings reply returns only "a password is saved: yes/no". A readable-text value is refused with "re-enter the password" (no automatic conversion). Errors and logs never include the password or the request body. No schema change.
- **Depends on:** Part 1 item 2; approval of where the key lives (copy kept in your password manager); Fire Recovery testing with sandbox department ID `FD12345678` as decided 2026-10-29; Fire Recovery has changed the old password.
- **Regression risk:** if the key is lost or missing, billing stops until an admin re-enters the password. No department data is lost.
- **Automated tests:** encrypt/decrypt round trip; altered stored text rejected; wrong key rejected; settings reply never contains the password; a failed Fire Recovery call does not leak it; readable-text value refused.
- **Staging check:** save a password; in Neon the value starts with `enc:v1:` and does not contain the password; one sandbox submission succeeds; Render logs show no password.

**Verification 2026-10-31: VERIFIED FIXED in code (local).** The saved value began with `enc:v1:` and did not contain the password. Neither the settings reply nor the server log contained it. A readable-text value was refused with "re-enter the password". Not verified on Render: the key does not exist there yet. Fix 8 is on this practice branch, so those letter-case paths are rejected here. Staging and production do not have fix 8 yet. Follow-ups (low): the Fire Recovery subscription key is still stored as readable text (masked on screen). The key setting is hashed with SHA-256 with no minimum strength check, so use a long random value.

### Fix 7 — Any signed-in user can read billing records (audit MEDIUM-3) — built on this branch, not released
- **Affected code:** `server/auth/permissions.mjs` (permission list and route mapping); front end `src/api/fireRecovery.ts` and billing display in `src/App.tsx`.
- **Smallest safe change:** New `billing.view` permission protecting `GET /api/fire-recovery/incidents` and `GET /api/fire-recovery/incidents/:callNumber`. Front end hides billing information without it. Defaults live in code; no database change.
- **Depends on:** your choice of the default role for `billing.view` (proposed: admin).
- **Regression risk:** regular users stop seeing billing information (intended); screens must not show errors.
- **Automated tests:** route maps to `billing.view`; regular user gets 403; admin gets 200.
- **Staging check:** regular test user sees no billing information and no errors; admin sees billing as before; a department admin can lower the permission.

**Verification 2026-10-31: PARTIALLY FIXED.** The exact path returned 403 for a regular user, but `GET /api/fire-recovery/incidents/` (trailing slash) and `/api/Fire-Recovery/incidents` returned 200. Fixed by fix 8.

---

## Part 4 — Safely deferred, with restrictions

| # | Item | Restriction until fixed | When |
|---|---|---|---|
| D1 | Suspended/archived departments can still sign in (audit MEDIUM-2). | Do not rely on department status to cut off access. To cut off a department, the program owner cancels its sessions and disables its accounts. | Before any department is suspended. Moves into Part 2 if a department is already suspended or archived. |
| D2 | Report/incident data stays in the browser after a session expires (audit MEDIUM-5). | Users on shared station computers must click Sign out; shared computers use separate Windows sign-ins. | After Stage C; clearing rule needs approval first. |
| D3 | Readable-text password fallback in `verifyPassword` (audit MEDIUM-4). | Safe only while the readable-text count stays `0` in both databases. | Stage C: remove the fallback, add a test. |
| D4 | Detailed internal error messages returned to the browser (audit LOW-1). | **Moved to Part 2, fix 10** after verification found stack traces with server file paths. | Before the Stage B release. |
| D5 | Origin check ignores scheme and port (audit LOW-2). | Keep HTTPS-only at Cloudflare; session cookie is already strict and host-only. | Stage C. |
| D6 | Sign-in for an unknown username replies faster than for a real one (reveals which usernames exist). | Lockout reduces the risk. | Stage C: compare against a dummy hash when the user does not exist. |
| D7 | 12 moderate warnings in development tools only; session tests skip without a local database. | Not shipped to users; CI covers the session tests. | When convenient. |

---

## Part 5 — Release order

### Promote this branch to staging
0. Fixes 8, 9, and 10 are already built on this branch (commits `019f06d`, `6ecd113`, `1857c9c`) and their automated tests passed. Local letter-case and trailing-slash checks passed on the practice site. Do not rebuild them. Their staging checks are still open and happen in step 5 below.
0a. Fixes 11, 12, 13, and 14 are built on this branch (commits `939a629`, `70ac3d5`, `aa9eba0`, `4eaed9e`). Lint, build, and `npm test` (23 tests) passed. The operator opened and saved report `26-UPPER` on the practice site on 2026-11-01. Do not rebuild them. Their staging checks are still open and happen in step 5 below.
1. Neon backup of `fireultimate-staging`. **Done 2026-11-01, about 1:07 p.m. America/Chicago.** Branch `backup-2026-11-01-before-stage-b`. Incident count **22**. Leave it alone. Do not connect Render to it. Do not open `fireultimate-prod`.
2. Add `dispatch@co.iroquois.il.us` to Crescent's allowed-sender list on the **live** staging branch `production` in project `fireultimate-staging`. **Done 2026-11-01, about 1:14 p.m. America/Chicago.** Row id `allow-cifpdil-dispatch-20261101`, pattern type `exact_email`, enabled. The read-back showed that one row. Do not delete it. The Allowed Senders screen is on this practice branch and is not on the current staging site. After the promote, later changes are made in Admin Functions → Dispatch Parsing Settings → Allowed Senders.
3. `prisma migrate deploy` against the live staging database only. **Done 2026-11-01, about 1:19 p.m. America/Chicago.** The operator confirmed `Session`, `RolePermission`, `AccountAuditLog`, and `NerisReportChange`. Do not run this against `fireultimate-prod` or against `backup-2026-11-01-before-stage-b`. Do not run seed or `migrate reset`.
4. Confirm the staging API can build, then promote this branch to `submenu/neris-golive-cifpd`. **Current staging program rebuilt successfully on 2026-11-01, about 1:29 p.m. America/Chicago. This practice branch is not promoted yet.** `CAD_INGEST_SECRET` is present on `fireultimate-api-staging`. A dashboard `NODE_ENV=production` was added and then removed. Render already sets `NODE_ENV=production` for the running server only. Do not add `NODE_ENV` as a dashboard variable on staging or production. Leave `CAD_INGEST_SECRET` in place. Do not merge to `main`. The promote is a separate merge of this pull request into `submenu/neris-golive-cifpd`, and it waits for the operator to say promote.
5. Follow `docs/procedures/RELEASE_CHECKLIST.md` for the sign-in check. Real CAD email must arrive; NERIS export and validation must work.

### Promote staging to production (`main`)
1. Production migration list compared on 2026-10-31. Production has the 10 names through `20260411190000_fire_recovery_tenant_api_credentials`. Apply only the three newer additions at release: Session, RolePermission plus AccountAuditLog, and NerisReportChange. The release checklist did not need a name correction. The allowed-sender SQL is still written in the release session, after the sender screen exists or the release is approved.
2. Readable-text passwords reset (if any). `admin`/`demo` passwords already changed (Part 1 item 1).
3. Neon backup of `fireultimate-prod`.
4. Apply this branch's database changes to production.
5. Add `dispatch@co.iroquois.il.us` to Crescent's allowed-sender list in the production database (exact SQL written after the migration list is reviewed). **This must happen before step 6, or real dispatch emails are rejected and lost.**
6. Deploy the code with `NODE_ENV=production`.
7. Send a test dispatch email and confirm it arrives. Confirm an unsigned request to `/api/users` returns 401, and that `/API/users` and `/API/admin/tenants` (no key) do not return data or succeed.
8. Fire Recovery production restriction (Part 3) stays in force.

### Stage C
Fixes 5, 6, 7 on this branch → Fire Recovery changes the old password → staging → production → only then save the Fire Recovery password in production.

---

## Decisions needed

- **Part 0 / Fix 15:** **DONE** on staging and production (2026-11-01). Do not rebuild. Do not merge this Stage B practice branch for Part 0.
- **Fixes 8, 9, and 10:** approved and built on this practice branch on 2026-11-01. The operator's practice-site click checks passed. Not released.
- **Fixes 11–14:** approved, built, and click-checked on this practice branch on 2026-11-01. Report `26-UPPER` opened and saved. Not released. Fix 13 treats HEAD as a normal read. Fix 16 is not built. Fix 17 stays the 15-minute lock, with no code change.
- **Fix 15:** **DONE.** Staging and production both verified by the operator on 2026-11-01.
- **Fix 16:** whether a validator name should be recorded at all (5a). How NERIS answers a second export (5b) is checked on staging during Stage C.
- **Fix 17:** kept as the 15-minute lock. No code change for Stage B.
- Fix 1's memory cap and fail-closed CAD intake (fixes 2 and 3) are built on this branch. Not released.
- Allowed-sender screen: built on this practice branch on 2026-11-01, at Admin Functions → Dispatch Parsing Settings → Allowed Senders. Not on staging until this branch is promoted. Crescent's address is `dispatch@co.iroquois.il.us`.
- Part 3 code is built on this practice branch and not released: fix 5, then 6, then 7. Fix 6 keeps the plan's Render setting `FIRE_RECOVERY_CREDENTIAL_KEY` (a different value on staging and production; a copy stays in the password manager). Do not create that setting during a coding session. Fix 7's `billing.view` default is admin, matching the October 29 decision that billing is admin-only.
- Approve the browser-clearing rule (item D2). Still later.
- Approve adding the Fire Recovery production restriction and the CAD release order (Part 5) to `docs/procedures/RELEASE_CHECKLIST.md`. Still later.

---

## Verification results (2026-10-31)

This section is the snapshot from before fixes 8, 9, and 10. It stays as the record of what that check found. Current status is the Progress line at the top. "Blocks release" in the table means the gap blocked a release on 2026-10-31. The code for those gaps is now on this branch and is not released. Do not start coding fixes 8–10 again.

Independent post-remediation verification, finished 10:27 p.m. America/Chicago, against commit `a7a9413`. No application code, settings, databases, or deployments were changed. All live checks ran on a throwaway local database with NERIS pointed at an unreachable address and made-up Fire Recovery credentials. Staging and production were not contacted.

**Overall: FAIL.** The remediation fixed most of what it targeted, but the sign-in and permission checks it relies on can be skipped (fix 8). Those gaps existed at the original audit commit `7e6b991` and were missed by the original audit.

### Results by original finding

| Finding | Result | Evidence | Remaining risk | Release effect |
|---|---|---|---|---|
| HIGH-1 Failed-login memory | PARTIALLY FIXED | `sessions.mjs` lines 56–117; login line 4303. Memory capped; 60 KB username refused. Probe: 13 guesses, no lock. | Flood resets counts; counts never expire. | Blocks release (fix 9). |
| HIGH-2 Readable Fire Recovery password | VERIFIED FIXED (code) | `secretBox.mjs`; save at line 3911. Stored `enc:v1:…`; not in replies or logs; readable value refused. | Key not on Render yet; settings can be overwritten until fix 8. | Key needed per environment. |
| HIGH-3 Browser-written export records | VERIFIED FIXED | Receipt writer at line 2953; browser posts refused at line 3066; billing check at line 4069. | Validator name blank; earlier exports need re-export. | Follow-ups 5a, 5b. |
| MEDIUM-1 CAD intake fail-open | VERIFIED FIXED | `ingestGuard.mjs`; allowlist at line 2049. | Staging has 0 allowed senders; no screen yet. | CAD stops if released before a sender is added. |
| MEDIUM-2 Suspended departments | NOT FIXED (deferred D1) | No status check. A suspended department kept its session and could sign in. | As planned. | Restriction in D1. |
| MEDIUM-3 Billing reads | PARTIALLY FIXED | `permissions.mjs` lines 102–107. Exact path 403; trailing slash or case 200. | Bypass. | Blocks release (fix 8). |
| MEDIUM-4 Readable user passwords | NOT FIXED (deferred D3) | `neris-proxy.mjs` line 239. Operator reported count 0 (not independently checked). | As planned. | Count must stay 0. |
| MEDIUM-5 Browser cache | NOT FIXED (deferred D2) | Not tested in a browser. | As planned. | Restriction in D2. |
| LOW-1 Internal error messages | NOT FIXED | 49 raw messages; HTML stack trace on bad JSON. | Internal detail leak. | Moved to fix 10. |
| LOW-2 Origin check | NOT FIXED (deferred D5) | `sessions.mjs` line 168. A different port was accepted. | As planned. | Restriction in D5. |

### New findings
1. **CRITICAL** — Capitalized `/API/` paths skip sign-in. Fix 8.
2. **CRITICAL, production and staging today** — Capitalized `/API/admin/` paths skip the platform admin key. Part 0.
3. **HIGH** — Trailing slash or letter case skips role permissions for signed-in users. Fix 8.
4. **MEDIUM** — Flooding resets the login lockout. Fix 9.
5. **LOW** — Login failure counts never expire. Fix 9.
6. **LOW** — Fire Recovery subscription key stored as readable text (masked on screen). Part 3 follow-up.
7. **INFO** — Encryption key is a SHA-256 hash of the setting text, with no strength check. The encrypted value is not tied to its department.

### Functionality regressions
- Earlier NERIS success records no longer qualify for billing (follow-up 5b).
- Validator name is blank on server-written export records (follow-up 5a).
- CAD intake stops where the allowed-sender list is empty (documented; Stage D step 23).
- Local development now needs `CAD_INGEST_SECRET` (documented).
- No regression found in sign-in, sign-out, the 60-minute idle limit, tampered cookies, another department's cookie, or CAD intake from an allowed sender.

### Automated checks run
`npm run lint` passed. `npm run build` passed. `npm test` passed: 14 suites, 22 tests, including the session integration test (286 assertions) against a throwaway local Postgres.

### Still to verify on staging or at deployment
Creating `FIRE_RECOVERY_CREDENTIAL_KEY` on Render and saving a password with it; a real NERIS test export creating its server record; a second export of an already-exported incident; a real dispatch email through the Cloudflare Worker after the sender is added; `NODE_ENV=production` set on both services; `TRUST_PROXY` left unset; browser cache behavior (D2). Commits after this snapshot, through `1857c9c`, include View Exports (`25b30c1`), the Part 0 key check (`ba777be`), and fixes 8–10. Those are built on this practice branch. Their staging checks are still open. The operator's practice-site click check of fixes 8–10 passed on 2026-11-01 with no issues.

---

## Verification results (2026-11-01)

Second independent post-remediation verification, 2026-11-01 (America/Chicago), against code commit `1857c9c` (`ae12854` after it changes documentation only). No application code, settings, databases, or deployments were changed. Live checks ran on a throwaway local database (`fu_session_test`) with NERIS pointed at an unreachable address and made-up Fire Recovery credentials. The database was dropped afterward. Staging and production were not contacted. `main` (`3f9b97a`) and staging (`2d985fa`) were read from git only.

**Overall: FAIL.** The fixes from the first verification work. Fix 8 introduced a regression (fix 11), and three smaller gaps remain (fixes 12–14). The fix plan is Part 2B.

### Results by item

| Item | Result | Evidence | Next step |
|---|---|---|---|
| Part 0 admin key (this branch) | VERIFIED FIXED | `/API/admin/...` and `/api/Admin/...` with no key returned 403. | Fix 15 for `main` and staging. |
| Part 0 admin key (`main`, staging) | VERIFIED FIXED | Staging and production operator checks passed 2026-11-01. PRs #32 and #33 merged. | Fix 15 done. |
| Fix 8 letter case and trailing slash | VERIFIED FIXED, with regression | Signed out, `/API`, `/aPi`, and trailing-slash variants returned 404 or 401. A regular user got 403 on the exact path and 404 on variants. Capital letters in a call number also return 404. | Fix 11. |
| Fix 7 billing reads | VERIFIED FIXED | Regular user: 403 on the exact path, 404 on case and slash variants. `HEAD` still returned 200. | Fix 13. |
| Fix 9 lockout | VERIFIED FIXED | Five wrong passwords lock a known account; flooding did not reset it. Anyone who knows a username can trigger the lock. | Fix 17 (decision). |
| Fix 10 error replies | PARTIALLY FIXED | Broken JSON returns a short JSON reply. Route replies still carry raw Prisma text (`127.0.0.1:5432` with the database stopped). Broken JSON bodies are printed to the server log. | Fixes 12 and 14. |
| Fix 5 export records | VERIFIED FIXED | A browser "success" post returned 400. | Fix 16 (5a, 5b). |
| Fix 6 Fire Recovery password | VERIFIED FIXED (local) | Stored value began with `enc:v1:`. | Key on Render at release. |
| Fixes 2 and 3 CAD intake | VERIFIED FIXED | Missing secret returned 401. Unknown sender rejected; 0 rows saved. | Crescent sender before release. |
| D1, D2, D3, D5, D6 | NOT FIXED (deferred) | Unchanged. | Part 4. |

### New findings
1. **HIGH (regression)** — Capital letters in a call number or ID give "Not found". Fix 11.
2. **MEDIUM** — A broken JSON body, including any password in it, is printed to the server log. Fix 12.
3. **LOW** — `HEAD` skips the permission check and reveals whether a record exists and its size. Fix 13.
4. **LOW** — 49 route replies still send raw internal error text. Fix 14.
5. **LOW** — Anyone who knows a username can lock that account for 15 minutes. Fix 17.
6. **Correction** — The blank validator name is not a regression; it was blank before fix 5. Fix 16.

### Automated checks run
`npm run lint` passed. `npm run build` passed. `npm test` passed (22 tests). `npm audit --omit=dev` found 0 issues. 12 moderate warnings remain in development tools only (D7).

### Still to verify on staging or at deployment
Everything listed under the October 31 "Still to verify" list, plus each Part 2B staging check after fixes 11–14 are promoted, and fix 15's 403 check on each live environment after it is deployed.
