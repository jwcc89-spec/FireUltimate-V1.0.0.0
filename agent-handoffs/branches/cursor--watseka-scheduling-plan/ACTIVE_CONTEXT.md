# Active Context Snapshot (cursor/watseka-scheduling-plan)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma. Do not upgrade Prisma.
- **Tenancy:** Every tenant-scoped read and write uses `tenantId`. On this Mac, `localhost` is the `demo` tenant. That tenant is the throwaway "Weekday Test Fire Department," not Crescent.
- **Time format:** 24-hour times everywhere. The only short-clock exception already built is the Info and Trades coverage lines (`8A-2P`).
- **Details:** `docs/system_architecture.md`, `docs/data_model.md`, `cursoragent-context.md`, `.cursor/project-context.md`.

## Current branch
- `cursor/watseka-scheduling-plan`. Folder slug: `cursor--watseka-scheduling-plan`. Created from the merged practice branch, PR #34, `4c80de8`.
- Confirm the latest commit with `git log -1` after pull. The Step 11 commit comes after the handoff `19b2f5b`.
- This is a practice branch on the user's Mac. Do not merge to `main`. Do not push `submenu/neris-golive-cifpd`. Do not touch staging, production, Crescent, or Watseka.
- The user is driving this Mac with Cursor Remote Control. Keep editing here. A cloud agent is only a backup if this chat is lost.

## Current focus
- Weekday 12-hour schedule test for one paid-on-call shift, Monday–Friday, 08:00–20:00. The shift saved in the test department is named `8a-8p` and its recurrence is still Daily, so Saturday and Sunday still appear. Weekday-only recurrence is plan Step 3 and is not built.
- Personnel → Trades, plan Stage D. Steps 8 through 11 passed the click-test, including a paramedic in a lower seat moving up. Step 12 is built. The user has the Step 12 click-test and has not reported the result yet.
- Plan, live for the user in Cursor: the canvas `weekday-schedule-test-plan`. Repo copy is the source of truth: `docs/plans/canvases/weekday-schedule-test-plan.canvas.tsx`. After every plan change, copy that file to the live canvas path and commit both. Live path on this Mac: `/Users/jeremywichtner/.cursor/projects/Users-jeremywichtner-CursorProjects-FireUltimate-V1-0-0-0/canvases/weekday-schedule-test-plan.canvas.tsx`.
- Latest session note: `agent-handoffs/branches/cursor--watseka-scheduling-plan/sessions/2026-11-03-session.md`
- Earlier the same day: `sessions/2026-11-03-local-test-setup.md` covers creating the throwaway database. Trust this file over that note's "Step 2 is next" status. Its password line is stale.
- User summary: `agent-handoffs/branches/cursor--watseka-scheduling-plan/conversations/2026-11-03-session-summary.md`
- Start prompt: `agent-handoffs/branches/cursor--watseka-scheduling-plan/COPY_PASTE_START_PROMPT.md`

## Latest known status
- Steps 8–10 click-test passed on November 3, 2026.
- Step 11: `POST /api/trades` refuses the request before saving it. The reason shows in the centered notice on Personnel → Trades.
- Step 12: Accept, or Approve when admin approval is on, splits the schedule. Deny does not. The previous day is stored on the trade as `scheduleChangeJson`.
- `npm run lint` and `npm run build` passed after Step 12. `node --test server/trades/eligibility.test.mjs server/trades/applySchedule.test.mjs` passed (18 tests). This cloud agent has no `~/fu-local-db`, so the on-screen check is the user's.

## This Mac's test runtime (do not point at staging)
- Repo: `/Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`
- Throwaway database: `~/fu-local-db`, port 5433, database `fu_local`. Start with `node ~/fu-local-db/start.mjs`. It lives outside the repo.
- Local API, in the repo folder: `env -u DATABASE_URL node --env-file=$HOME/fu-local-db/api.env server/neris-proxy.mjs` on port 8787.
- Screens: `npm run dev` then `http://localhost:5173`. Reload once after a client change.
- **Never run `npm run proxy` for this test.** `.env.server` points at the staging database.
- A cloud agent does not have `~/fu-local-db`. Do not invent a staging connection to replace it. Say so and keep working from the repo copy.
- The admin password was changed by the user. Do not reset it and do not guess it. The canvas still shows the original throwaway password. Treat that line as stale.
- Accounts on the test department: `admin` (admin), `wicj` Joshua Wichtner (user), `baik` Kenny Baier (user), `kell` Lance Keller (user), `ledl` Landon LeDuke (user). Full names are in the department payload `userFullNames`. The roster is `schedulerPersonnelRecords`. Each person's shift value looks like `8a-8p | 08:00 | 12 | Daily | Station 1`. The Trades screen shows only the part before the first `|`.

## What is already decided
- Trades are one row each in the `TradeRequest` table. Migration `prisma/migrations/20261103210000_add_trade_request`. Applied only to `fu_local`. Staging and production need `prisma migrate deploy` when this branch is released. Do not run that now.
- Members see only trades they are in. Sub Admin, Admin, and Super Admin see every trade and can filter Active Requests by All trades, My trades, or one shift.
- The other person must click Accept. Deny needs a reason. Only that person can accept or deny.
- Scheduler Settings → Trades has three checkboxes, all starting off: Admin approval for trades, Payback required, Require approval before cancelling a trade. They are department payload flags `tradeAdminApproval`, `tradePaybackRequired`, and `tradeCancelApproval`.
- Payback required on a new request starts from that department setting. The sender can change it for one request. When it is off, Date You Work Instead is gray. When a payback date is entered, Step 12 puts the requester on that day in the other person's place for the same hours.
- With admin approval on, Accept sets status `awaiting_admin`. A sub admin or above then Approves (`accepted`) or Denies (`admin_denied`, reason required). With it off, Accept sets `accepted`.
- Before a request is saved, the other person is checked against the truck for those hours. Someone already on that truck can move into the seat being given up when they hold that qualification, and the new person must meet the seat that move opens. A higher qualification can cover a lower seat. Injury / Vacation / Sick / Kelly Day and overlapping hours are reported before the qualification message. Chief on Call does not block. If the requester is not on a seat for those hours, only leave and overlap are checked.
- When the trade becomes accepted, the same split is written on the schedule. For 08:00–10:00, the arriver covers 08:00–10:00 and the person who left keeps 10:00–20:00. A paramedic in a lower seat moves up for those hours. The Trades row lists the pieces. Payback runs the same checks and puts the requester on the counterpart's seat for the same clock hours. The previous schedule day is kept in `scheduleChangeJson`.
- Cancel approval is saved and shown as a note. The Cancel button is Step 13. Either person requests the cancel, the other accepts, and an admin too when that box is on. Then both days go back to how they were.
- Your Assigned Date can be typed or picked from days the person is already on a truck or a split piece. Support rows such as Injury are not scheduled-work days. On November 3, Joshua was on `8a-8p` for 2026-11-01, 03, 05, 06, 07, and 09.
- Trade With lists Scheduler Settings → Personnel except the signed-in person. Both people need a sign-in account. You cannot trade with yourself.
- Times are typed in 24-hour form. `8` or `0800` becomes `08:00`.

## Current blocker / status
- Waiting on the user to finish the Step 12 click-test in the November 3 session summary. Do not start Step 13 until they say what matched and what did not.

## Now vs later
- **Now:** wait for the Step 12 click-test. Fix only what failed.
- **Later:** Step 13 cancels a trade and writes `scheduleChangeJson` back onto both days. Step 3 is Monday–Friday recurrence. Staging comes only after the user asks, under the canvas Data safety rules.

## Next agent should do this first
1. Stay on `cursor/watseka-scheduling-plan`. Read this file, the November 3 session note, and the session summary.
2. Read `docs/plans/canvases/weekday-schedule-test-plan.canvas.tsx` Stage D before editing.
3. Ask the user how the Step 12 click-test went. Fix only what failed. Do not rebuild Steps 8–12.
4. After they accept it, implement Step 13 only, then lint, build, and give a click-test.
5. Update this file, the session note, and the canvas together. Copy the canvas to the live path on this Mac. Commit and push only when the user asks, or when they say the session is ending.
