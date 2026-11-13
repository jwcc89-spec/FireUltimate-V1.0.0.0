# Agent Handoff Note — Wave 7 done, wait for Fire Recovery

## Session metadata
- Date: 2026-11-02, America/Chicago
- Agent type: Cursor Desktop
- Agent name/label: Grok 4.7
- User request focus: Finish the staging sandbox bill, then leave a handoff while Fire Recovery USA's email reply is pending
- Working branch: `cursor/stage-b-foundation-b5ff`

## Starting context
- Read this file first, then `ACTIVE_CONTEXT.md`, then `docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md`.
- Stay on `cursor/stage-b-foundation-b5ff`. Do not switch branches.
- Production is `main`. Do not merge to `main`.

## Where the code is
- Staging branch `submenu/neris-golive-cifpd` is pull request 34, commit `4c80de8` (2026-11-02, 11:30 America/Chicago). That deploy includes Fire Recovery through Wave 6 (`3663d26`).
- This practice branch is two commits ahead of staging:
  - `746ed5e` — a successful NERIS export may save the NERIS id while marking the report Exported. Preview also accepts a successful receipt when the saved report is still In Review.
  - `286051c` — the sandbox bill record in the plan.
- Those two commits are not deployed. Do not push this branch onto `submenu/neris-golive-cifpd` unless the operator asks. That push redeploys `fireultimate-api-staging`.
- `gh` is not installed on the operator's Mac.

## What already happened
- Waves 1–6 are built. Wave 6 tests are in `server/fireRecovery.test.mjs`. `npm test` passed 44 tests against local `fu_session_test` only, before the export-stamp change. After `746ed5e`, `node --test server/auth/sessions.test.mjs` passed. `npm run lint` and `npm run build` passed. Local Postgres at `/tmp/fu-pg-bin` was stopped afterward.
- NERIS Entity ID screen: Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration. Fire Recovery login screen: Admin Functions → Setup/Configuration → Fire Recovery.
- Incident 12345 on the demo tenant exported 201 Created at 11:14:04 America/Chicago.
- Crescent staging (`https://cifpdil.staging.fireultimate.app`) sandbox bill:
  - Preview showed the yellow line "SANDBOX — Fire Recovery will not bill this." and department ID `FD12345678`.
  - Party, run number, incident type, alarm, cleared time, location, and personnel looked correct to the operator.
  - Confirm and send at 12:21 p.m. Status Sent. Tracking ID `c7aaf46a-fd7b-4ea8-9bd6-d644bbfd3418`.
  - A second Confirm and send closed the window. One Sent row is stored for tenant `cifpdil`.
  - Update billing status at 12:22 p.m. said "Billing status updated." Invoice status Unassigned. Amount due and amount paid were blank.
- Staging Render already has `FIRE_RECOVERY_CREDENTIAL_KEY` and `FIRE_RECOVERY_MODE=sandbox`. Do not print or change them. Production has neither.
- Staging database already has migration `20261102140000_fire_recovery_submit_status`. The command that works from this Mac is `node --env-file=.env.server ./node_modules/.bin/prisma migrate deploy` after `cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`. Do not run `npm run db:seed`. This Mac's `.env.server` points at staging Neon. Do not run a migration against production.
- One Crescent draft (call `cmvzk6saq00013hopxzxzawvv`) was set to Exported in the staging database after NERIS returned 201 while the saved status stayed In Review. The export stamp writes `incident_neris_id`, and the old lock rejected that save. Do not change that row again.

## Open blocker
- The operator sent the Fire Recovery email the night of 2026-11-01 from `support@fireultimatehq.com` to `support@firerecoveryusa.com`. The draft is plan §13, including this tracking ID.
- Q5 is still open: is the Welcome login also for real bills? That blocks Wave 8.
- Do not start Wave 8, Wave 5b, or production while waiting.

## Next steps for next agent
1. Wait. Do not code a production release. Do not click Confirm and send or Save Fire Recovery on this Mac.
2. When the operator pastes Fire Recovery's reply: if the Welcome login works for real bills, and the operator says to start Wave 8, follow plan §11.3 and `docs/procedures/RELEASE_CHECKLIST.md`. The first step is a fresh backup of `fireultimate-prod` and a written yes. Production needs four migrations that staging already has: `20261029180000_add_session`, `20261029200000_add_role_permission_and_account_audit`, `20261030180000_add_neris_report_change`, and `20261102140000_fire_recovery_submit_status`. Then §11.1 on `fireultimate-api-prod` with `FIRE_RECOVERY_MODE=live`. The preview must show the red LIVE banner and Crescent's real NERIS entity ID, never `FD12345678`.
3. If Fire Recovery says the Welcome login is sandbox-only, stop. Wait for the real login. Do not send a live bill with the sandbox login.
4. Wave 5b (re-export an older NERIS incident, then bill) stays waiting until the operator asks. It is also Fix 16 / 5b in the security plan. Do not upgrade old export rows.
5. Include commit `746ed5e` in any later staging or production release so the next NERIS export can save the NERIS id. The current staging site does not have that commit.

## Notes for user communication
- The operator does not need to click anything while waiting.
- Do not ask the operator to paste the Fire Recovery password.
- End each response with the agent name.
