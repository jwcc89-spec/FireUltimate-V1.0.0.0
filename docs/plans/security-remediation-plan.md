# Security Remediation Plan (live)

**Role of this file:** open work, hard restrictions, and release order only.  
**Completed narrative / fix recipes / verification snapshots:** [`docs/completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md`](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md)  
**Release procedure:** [`docs/procedures/RELEASE_CHECKLIST.md`](../procedures/RELEASE_CHECKLIST.md)

---

## Current status (2026-11-13, America/Chicago)

- **Stage B on staging:** done. Crescent click test on `https://cifpdil.staging.fireultimate.app` passed ~2:09 p.m. America/Chicago on 2026-11-01.
- **Fire Recovery on staging:** sandbox bill passed 2026-11-02. Tracking ID `c7aaf46a-fd7b-4ea8-9bd6-d644bbfd3418`. Vendor confirmed import without errors on 2026-11-13.
- **Production (`main`):** Wave 8 released 2026-11-13 (PR #44, then follow-up merges through `b60eb44`). Backup `backup-2026-11-13-wave8-fire-recovery` (63 incidents). Crescent allowed sender is on production. Operator set Fire Recovery live and sent one real bill, tracking ID `412c2d90-6489-4b63-9fa0-6570adf33bb2`. Do not send another live bill unless asked.
- **Part 0 / fix 15:** done on staging (PR #32) and production (PR #33). Do not rebuild.
- **Parts 1–2 / fixes 1–4 and 8–14:** on staging (practice click checks + Crescent staging click test). Do not rebuild. Details in the [archive](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md).
- **Part 3 / fixes 5–7:** on staging and on production. The first live bill was sent 2026-11-13. Do not send another unless asked.
- **Allowed Senders:** Crescent row `dispatch@co.iroquois.il.us` (exact, enabled, id `allow-cifpdil-dispatch-20261101`) is on staging and on production. Do not delete. Empty list rejects mail.
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

1. Production promote for Stage B and Fire Recovery is done (2026-11-13). Do not rebuild it.
2. Remaining checks not recorded this session: a production CAD test email, and unsigned `/api/users` returning 401 on production.
3. Do **not** print or recreate `FIRE_RECOVERY_CREDENTIAL_KEY`.
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

### Promote staging to production (`main`) — done 2026-11-13

Backup, allowed sender, migrations (already present), and the `main` deploy are done. A production CAD test email and the unsigned `/api/users` check were not recorded in this session.

### Stage C — first live bill sent

Welcome login works for real bills. Production Fire Recovery is live. Tracking ID `412c2d90-6489-4b63-9fa0-6570adf33bb2`. Recovery Hub shows Draft. Fix 16 / Wave 5b is not started. Do not start it unless asked.

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
