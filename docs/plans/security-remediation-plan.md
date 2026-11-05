# Security Remediation Plan (live)

**Role of this file:** open work, hard restrictions, and release order only.  
**Completed narrative / fix recipes / verification snapshots:** [`docs/completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md`](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md)  
**Release procedure:** [`docs/procedures/RELEASE_CHECKLIST.md`](../procedures/RELEASE_CHECKLIST.md)

---

## Current status (2026-11-04, evening America/Chicago)

- **Stage B on staging:** done since 2026-11-01. Crescent staging click test passed ~2:09 p.m. America/Chicago. Staging branch is `submenu/neris-golive-cifpd` (feature tip `b52c3a4` after the weekday schedule promote).
- **Stage B on production:** done 2026-11-04. PR #37 merged staging into `main` as `6efda0e`. Production backup `backup-2026-11-04-before-production-weekday`. Migrations applied through `20261104180000_add_qualification_override_request` (16 total). Render **fireultimate-api-prod** Build Command is `npm ci --engine-strict=false && npm run build`. Deploy succeeded. Crescent check: NERIS reports intact; schedule unused; trades visible.
- **November 1–2 security and Stage C code on production:** Parts 0–3 security fixes (sessions, permissions, route case, CAD ingest guards, NERIS export receipts, Fire Recovery password encryption code, billing.view) plus Stage C Waves 1–6 Fire Recovery UI/submit code are in the production program via that merge. **Do not treat billing as live.** Keep `FIRE_RECOVERY_MODE` unset. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` until Wave 7/8.
- **Part 0 / fix 15:** done on staging (PR #32) and production (PR #33) since 2026-11-01. Do not rebuild.
- **Parts 1–2 / fixes 1–4 and 8–14:** on staging and production. Do not rebuild.
- **Part 3 / fixes 5–7:** code on staging and production. Fire Recovery password must stay unset in production until Stage C Wave 7/8.
- **Allowed Senders — staging:** Crescent row `dispatch@co.iroquois.il.us` (exact, enabled, id `allow-cifpdil-dispatch-20261101`) — do not delete.
- **Allowed Senders — production:** Crescent (`cifpdil`) list was **empty** when checked 2026-11-04 after the promote. Add the dispatch sender **before** relying on production CAD ingest, or real mail is rejected. CAD auto-create stays off unless a department turns it on.
- **CAD mailbox (To):** `cifpdil@cad.fireultimate.app`. Prefer Raw Email / Neon over Render log search for proof.
- **Backups to leave alone:** staging `backup-2026-11-01-before-stage-b` and `backup-2026-11-04-before-weekday-schedule`; production `backup-2026-11-04-before-production-weekday`.
- **API build command (staging and production):** `npm ci --engine-strict=false && npm run build`. Do not add a dashboard `NODE_ENV` variable. Do not upgrade Node or Prisma for the engine warning.

**Branches:** practice work for Fire Recovery continues on `cursor/stage-b-foundation-b5ff` / weekday schedule on `cursor/watseka-scheduling-plan`. Live staging: `submenu/neris-golive-cifpd`. Live production: `main` at `6efda0e`.

---

## Done (index only — see archive for recipes)

| Item | Where details live |
|---|---|
| Part 0 admin-key case check + fix 15 live hotfix | [Archive — Part 0 / Fix 15](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 1 hands-on (passwords, FR password cleared, queries, `CAD_INGEST_SECRET` name) | [Archive — Part 1](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 2 fixes 1–4, 8–10 | [Archive — Part 2](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 2B fixes 11–14 | [Archive — Part 2B](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 5 staging promote + Crescent staging click test | [Archive — Part 5 staging](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |
| Part 5 production promote (2026-11-04) | This file — Current status; weekday handoff `sessions/2026-11-04-production-release.md` |
| Verification snapshots 2026-10-31 and 2026-11-01 | [Archive — Verification](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) |

---

## Next actions (do now)

1. **Before production CAD ingest is relied on:** add Crescent’s `dispatch@co.iroquois.il.us` (exact, enabled) to production Allowed Senders. Staging already has this row.
2. Keep **Fire Recovery billing off** until Stage C Wave 7 sandbox test and Wave 8. Leave `FIRE_RECOVERY_MODE` unset. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` in a coding session.
3. Do **not** rebuild Part 0 or fixes 1–14.
4. Optional later: create Watseka production tenant `watsekafire` / `watsekafire.fireultimate.app` when the user asks (separate from security).

---

## Part 3 — Must be configured before Fire Recovery bills go live (Stage C)

Code for fixes 5–7 is on staging and production. Full recipes: [archive Part 3](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md).

**Production restriction until Wave 7/8:** Fire Recovery password count must stay `0`; do not submit bills from production; do not set `FIRE_RECOVERY_MODE=live`.

| Fix | Summary | Still needed |
|---|---|---|
| **5** | Server writes successful NERIS export records | Confirm on production if needed; see fix 16 for 5a/5b |
| **6** | Encrypt Fire Recovery password with `FIRE_RECOVERY_CREDENTIAL_KEY` | Operator creates key on Render at Wave 7/8; re-enter password after |
| **7** | `billing.view` on Fire Recovery GETs | Confirm regular user sees no billing; admin still does |

### Fix 16 — NERIS export follow-ups (5a / 5b) — Stage C, not built

- **5a (optional):** record `validatorName` on export if the user wants a name stored.
- **5b:** older success rows lack the server mark and no longer count for billing. Do **not** “upgrade” old rows. Check on staging during Stage C.

### Fix 17 — Login lock abuse — decided for Stage B

Keep the 15-minute lock after five failures. No code change. If someone is locking accounts on purpose: restart API and/or add a Cloudflare rate limit on `/api/auth/login`.

---

## Part 4 — Deferred (restrictions still apply)

| # | Item | Restriction until fixed | When |
|---|---|---|---|
| D1 | Suspended/archived departments can still sign in | Do not rely on status to cut off access; cancel sessions and disable accounts | Before any department is suspended |
| D2 | Report/incident data stays in browser after session expiry | Shared station PCs: Sign out; separate Windows sign-ins | After Stage C; needs clearing-rule approval |
| D3 | Readable-text password fallback in `verifyPassword` | Safe only while readable-text count stays `0` in both DBs | Stage C: remove fallback + test |
| D4 | Internal error messages to browser | **Moved** into Part 2 / fixes 10, 12, 14 | — |
| D5 | Origin check ignores scheme/port | HTTPS-only at Cloudflare; cookie already strict/host-only | Stage C |
| D6 | Unknown username replies faster (username oracle) | Lockout reduces risk | Stage C: dummy hash compare |
| D7 | Dev-tool warnings; session tests skip without local DB | Not shipped; CI covers session tests | When convenient |

---

## Part 5 — Release order

### Staging → done (2026-11-01)

See [archive Part 5](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md).

### Promote staging to production (`main`) → done (2026-11-04)

1. Production backup `backup-2026-11-04-before-production-weekday` created by the operator.
2. `prisma migrate deploy` with `.env.production` applied Session, RolePermission/AccountAuditLog, NerisReportChange, Fire Recovery submit status, TradeRequest, QualificationOverrideRequest (and confirmed 16 migrations finished).
3. PR #37 merged `submenu/neris-golive-cifpd` into `main` (`6efda0e`).
4. Render **fireultimate-api-prod** build command set to `npm ci --engine-strict=false && npm run build` after an `EBADENGINE` failure; redeploy succeeded.
5. Crescent production check: NERIS reports present; schedule unused; trades visible.
6. **Still open for CAD:** production Crescent Allowed Senders was empty after promote — add before CAD ingest is relied on.
7. Fire Recovery production restriction (Part 3) stays in force until Wave 7/8.

### Stage C — open

Wave 7 staging sandbox test → Wave 8 only after vendor Q5 and sandbox pass → then set Render keys and save Fire Recovery password. Then fix 16 as approved. See `docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md`.

---

## Open decisions

- **Fix 16 / 5a:** whether to record a validator name at all.
- **Fix 16 / 5b:** how NERIS answers a second export (check on staging during Stage C).
- **D2:** approve browser-clearing rule (later).
- **Production CAD allowlist:** when to add Crescent’s dispatch sender on production.

Decided (do not reopen without asking): Part 0/15 done; fixes 8–14 approved and on staging and production; fix 13 = HEAD as GET; fix 17 = keep 15-minute lock; `billing.view` default admin; `FIRE_RECOVERY_CREDENTIAL_KEY` naming kept; Stage B production promote completed 2026-11-04 with billing left off.

---

## Agent rules for this doc

1. Update **this file** for current status and open work. Do not revive long completed narratives here.
2. Do not rewrite the [archive](../completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md) status blocks; it is frozen evidence. Append only a dated footnote if a historical correction is required.
3. One fix = one commit when coding resumes. Lint, build, and test after each fix. No Prisma/schema/auth changes without explicit approval.
4. Preserve tenant isolation. No secrets in `DepartmentDetails.payloadJson`. Keep `demo` tenant persistent.
