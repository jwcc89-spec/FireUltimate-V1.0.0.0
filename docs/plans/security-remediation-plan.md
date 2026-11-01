# Security Remediation Plan (live)

**Role of this file:** open work, hard restrictions, and release order only.  
**Completed narrative / fix recipes / verification snapshots:** [`docs/completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md`](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md)  
**Release procedure:** [`docs/procedures/RELEASE_CHECKLIST.md`](../procedures/RELEASE_CHECKLIST.md)

---

## Current status (2026-11-01, America/Chicago)

- **Stage B on staging:** done. Crescent click test on `https://cifpdil.staging.fireultimate.app` passed ~2:09 p.m. America/Chicago.
- **Production (`main`):** not updated with Stage B. Do not merge until Part 5 production steps below are ready.
- **Part 0 / fix 15:** done on staging (PR #32) and production (PR #33). Do not rebuild.
- **Parts 1–2 / fixes 1–4 and 8–14:** built, tested, on staging. Do not rebuild. Details in the [archive](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md).
- **Part 3 / fixes 5–7:** built and on staging; **not** cleared for production Fire Recovery use until Stage C below.
- **Allowed Senders:** on staging at Admin Functions → Dispatch Parsing Settings → Allowed Senders. Crescent row `dispatch@co.iroquois.il.us` (exact, enabled, id `allow-cifpdil-dispatch-20261101`) — do not delete. Empty list rejects mail.
- **CAD mailbox (To):** `cifpdil@cad.fireultimate.app`. Prefer Raw Email / Neon over Render log search for proof.
- **Staging Neon backup:** `backup-2026-11-01-before-stage-b` (22 incidents). Leave alone. Do not connect Render to it.
- **Staging API build command:** `npm ci --engine-strict=false && npm run build`. Do not add a dashboard `NODE_ENV` variable. Do not upgrade Node or Prisma for the engine warning.

**Practice / code branch:** `cursor/stage-b-foundation-b5ff` → staging `submenu/neris-golive-cifpd` → production `main`.

---

## Done (index only — see archive)

| Item | Where details live |
|---|---|
| Part 0 admin-key case check + fix 15 live hotfix | [Archive — Part 0 / Fix 15](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 1 hands-on (passwords, FR password cleared, queries, `CAD_INGEST_SECRET` name) | [Archive — Part 1](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 2 fixes 1–4, 8–10 (build recipes, tests, local verification) | [Archive — Part 2](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 2B fixes 11–14 (recipes, commits, practice click checks) | [Archive — Part 2B](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 5 staging promote steps 1–5 + Crescent staging click test | [Archive — Part 5 staging](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Verification snapshots 2026-10-31 and 2026-11-01 | [Archive — Verification](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |

---

## Next actions (do now)

1. **Promote Stage B staging → production** using Part 5 production steps below (and `RELEASE_CHECKLIST.md`). Production must get Crescent’s allowed sender **before** code that rejects empty allowlists goes live.
2. Keep **Fire Recovery production locked down** until Stage C (fixes 5–7 live in production, then password save).
3. Do **not** create `FIRE_RECOVERY_CREDENTIAL_KEY` in a coding session. Operator creates it on Render at Stage C release.
4. Do **not** rebuild Part 0 or fixes 1–14.

---

## Part 3 — Must be live before Fire Recovery goes live (Stage C)

Code for fixes 5–7 is already on staging. Full recipes and local verification: [archive Part 3](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md).

**Production restriction until 5–7 are live in production:** Fire Recovery password count must stay `0`; do not submit bills from production.

| Fix | Summary | Still needed |
|---|---|---|
| **5** | Server writes successful NERIS export records; browser cannot forge “success” for billing readiness | Staging/prod: real NERIS test export creates one server success row; see fix 16 for 5a/5b |
| **6** | Encrypt Fire Recovery password (`enc:v1:…`) with `FIRE_RECOVERY_CREDENTIAL_KEY` | Operator creates key on Render (not in coding session); re-enter password after change; never log the secret |
| **7** | `billing.view` (default admin) on Fire Recovery incident GETs | Confirm regular user sees no billing; admin still does |

### Fix 16 — NERIS export follow-ups (5a / 5b) — Stage C, not built

- **5a (optional):** record `validatorName` on export if the user wants a name stored (blank is not a regression; it was blank before fix 5).
- **5b:** older success rows lack the server mark and no longer count for billing. Do **not** “upgrade” old rows. On staging, export one already-exported test incident again; record whether NERIS updates or duplicates. If update: Stage C note = re-export before billing. If duplicate: stop and ask.

### Fix 17 — Login lock abuse — decided for Stage B

Keep the 15-minute lock after five failures. No code change for Stage B. If someone is locking accounts on purpose: restart API and/or add a Cloudflare rate limit on `/api/auth/login`. Admin unlock / slowdown options stay later unless re-approved.

---

## Part 4 — Deferred (restrictions still apply)

| # | Item | Restriction until fixed | When |
|---|---|---|---|
| D1 | Suspended/archived departments can still sign in | Do not rely on status to cut off access; cancel sessions and disable accounts | Before any department is suspended |
| D2 | Report/incident data stays in browser after session expiry | Shared station PCs: Sign out; separate Windows sign-ins | After Stage C; needs clearing-rule approval |
| D3 | Readable-text password fallback in `verifyPassword` | Safe only while readable-text count stays `0` in both DBs | Stage C: remove fallback + test |
| D4 | Internal error messages to browser | **Moved** into Part 2 / fixes 10, 12, 14 (on staging) | — |
| D5 | Origin check ignores scheme/port | HTTPS-only at Cloudflare; cookie already strict/host-only | Stage C |
| D6 | Unknown username replies faster (username oracle) | Lockout reduces risk | Stage C: dummy hash compare |
| D7 | Dev-tool warnings; session tests skip without local DB | Not shipped; CI covers session tests | When convenient |

---

## Part 5 — Release order (open)

### Staging → done

See [archive Part 5](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) for the completed backup, allowlist, migrate, promote, and Crescent click-test record.

### Promote staging to production (`main`) — open

1. Production migration list (reviewed 2026-10-31): production has 10 migrations through `20260411190000_fire_recovery_tenant_api_credentials`. At release apply only the three newer ones: Session; RolePermission + AccountAuditLog; NerisReportChange.
2. Readable-text passwords: reset if any. Production `admin` already changed (Part 1).
3. Neon backup of `fireultimate-prod`.
4. Apply this branch’s database changes to production.
5. Add `dispatch@co.iroquois.il.us` to Crescent’s allowed-sender list in **production** (exact SQL in the release session). **Must happen before step 6**, or real dispatch email is rejected and lost.
6. Deploy code with `NODE_ENV=production` (do **not** add a Render dashboard `NODE_ENV` variable — it breaks install).
7. Send a test dispatch email; confirm arrival. Confirm unsigned `/api/users` → 401; `/API/users` and `/API/admin/tenants` (no key) do not return data or succeed.
8. Fire Recovery production restriction (Part 3) stays in force until Stage C.

### Stage C — open

Fixes 5–7 already on staging → Fire Recovery changes any old password if needed → staging confirmation → production → only then save Fire Recovery password in production. Then fix 16 (5a/5b) as approved.

---

## Open decisions

- **Fix 16 / 5a:** whether to record a validator name at all.
- **Fix 16 / 5b:** how NERIS answers a second export (check on staging during Stage C).
- **D2:** approve browser-clearing rule (later).
- **Docs:** whether to copy the Fire Recovery production restriction and CAD release order into `RELEASE_CHECKLIST.md` (still later unless asked).

Decided (do not reopen without asking): Part 0/15 done; fixes 8–14 approved and on staging; fix 13 = HEAD as GET; fix 17 = keep 15-minute lock; `billing.view` default admin; `FIRE_RECOVERY_CREDENTIAL_KEY` naming kept.

---

## Agent rules for this doc

1. Update **this file** for current status and open work. Do not revive long completed narratives here.
2. Do not rewrite the [archive](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) status blocks; it is frozen evidence.
3. One fix = one commit when coding resumes. Lint, build, and test after each fix. No Prisma/schema/auth changes without explicit approval.
4. Preserve tenant isolation. No secrets in `DepartmentDetails.payloadJson`. Keep `demo` tenant persistent.
