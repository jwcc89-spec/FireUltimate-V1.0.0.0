# Active Context Snapshot (cursor/watseka-scheduling-plan)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma. Do not upgrade Prisma.
- **Tenancy:** Every tenant-scoped read and write uses `tenantId`. On this Mac, `localhost` is the `demo` tenant. That tenant is the throwaway "Weekday Test Fire Department," not Crescent.
- **Time format:** 24-hour times everywhere. The only short-clock exception already built is the Info and Trades coverage lines (`8A-2P`).
- **Details:** `docs/system_architecture.md`, `docs/data_model.md`, `cursoragent-context.md`, `.cursor/project-context.md`.

## Current branch
- `cursor/watseka-scheduling-plan`. Folder slug: `cursor--watseka-scheduling-plan`. Created from the merged practice branch, PR #34, `4c80de8`.
- Session ended November 4, 2026, about 1:00 a.m. America/Chicago. Confirm the latest commit with `git log -1` after pull. The end-of-session handoff comes after `fc8c953`.
- This is a practice branch on the user's Mac. Do not merge to `main`. Do not push `submenu/neris-golive-cifpd`. Do not touch staging, production, Crescent, or Watseka.
- The user is driving this Mac with Cursor Remote Control. Keep editing here. A cloud agent is only a backup if this chat is lost.

## Current focus
- Weekday 12-hour schedule test for one paid-on-call shift, Monday–Friday, 08:00–20:00. The shift saved in the test department is named `8a-8p` and its recurrence is still Daily, so Saturday and Sunday still appear. Weekday-only recurrence is plan Step 3 and is not built.
- Personnel → Trades, plan Stage D. Steps 8 through 13 passed the click-test. The next build is plan Step 3, selected weekdays. Do not start it until the user approves the wording and layout.
- Shared plan link (November 4): https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/07bcb2d0-f8d5-448e-9b16-a5473b749ecc (canvas id `07bcb2d0-f8d5-448e-9b16-a5473b749ecc`). When the repo copy changes, republish to that same canvas id. Do not put passwords in it.
- The user reads the shared plan link above, not the raw `.tsx` file. The repo copy is the source of truth. After every plan change, commit that file and republish it to the same canvas id. The old Mac canvas path can be ignored: `/Users/jeremywichtner/.cursor/projects/Users-jeremywichtner-CursorProjects-FireUltimate-V1-0-0-0/canvases/weekday-schedule-test-plan.canvas.tsx`.
- Latest session note: `agent-handoffs/branches/cursor--watseka-scheduling-plan/sessions/2026-11-03-session.md`
- Earlier the same day: `sessions/2026-11-03-local-test-setup.md` covers creating the throwaway database. Stage A Step 2 is done; the user confirmed that on November 4. That note's password line is stale.
- User summary: `agent-handoffs/branches/cursor--watseka-scheduling-plan/conversations/2026-11-03-session-summary.md`
- Start prompt: `agent-handoffs/branches/cursor--watseka-scheduling-plan/COPY_PASTE_START_PROMPT.md`

## Latest known status
- Steps 8–10 click-test passed on November 3, 2026.
- Step 11: `POST /api/trades` refuses the request before saving it. The reason shows in the centered notice on Personnel → Trades.
- Step 12 passed the click-test on November 4. Accept, or Approve when admin approval is on, splits the schedule. A person who already works the whole shift and can fill a higher seat stays there all day. The previous day is stored on the trade as `scheduleChangeJson`.
- Step 13 passed the click-test on November 4. Either person clicks Cancel Requested Trade. The other person accepts. When `tradeCancelApproval` is on, a sub admin or above must approve before the schedule changes. `rowsFromScheduleChange` writes the saved days back and the status becomes `cancelled`. Keep Trade, or an admin Deny, leaves the schedule alone and returns the trade to `accepted`.
- Stage A Steps 1 and 2 are done. The user confirmed Step 2 on November 4. Do not restart the department setup.
- `npm run lint` and `npm run build` were run after Step 13. `node --test server/trades/eligibility.test.mjs server/trades/applySchedule.test.mjs` is the trade check (20 tests after the restore cases). This cloud agent has no `~/fu-local-db`, so the on-screen check is the user's.

## This Mac's test runtime (do not point at staging)
- Repo: `/Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`
- Throwaway database: `~/fu-local-db`, port 5433, database `fu_local`. Start with `node ~/fu-local-db/start.mjs`. It lives outside the repo.
- Local API, in the repo folder: `env -u DATABASE_URL node --env-file=$HOME/fu-local-db/api.env server/neris-proxy.mjs` on port 8787.
- Screens: `npm run dev` then `http://localhost:5173`. Reload once after a client change.
- **Never run `npm run proxy` for this test.** `.env.server` points at the staging database.
- A cloud agent does not have `~/fu-local-db`. Do not invent a staging connection to replace it. Say so and keep working from the repo copy.
- The admin password was changed by the user. Do not reset it and do not guess it. It is not written in the plan. An older session note still has the original throwaway password. Ignore that line.
- Accounts on the test department: `admin` (admin), `wicj` Joshua Wichtner (user), `baik` Kenny Baier (user), `kell` Lance Keller (user), `ledl` Landon LeDuke (user). Full names are in the department payload `userFullNames`. The roster is `schedulerPersonnelRecords`. Each person's shift value looks like `8a-8p | 08:00 | 12 | Daily | Station 1`. The Trades screen shows only the part before the first `|`.

## What is already decided
- Trades are one row each in the `TradeRequest` table. Migration `prisma/migrations/20261103210000_add_trade_request`. Applied only to `fu_local`. Staging and production need `prisma migrate deploy` when this branch is released. Do not run that now.
- Members see only trades they are in. Sub Admin, Admin, and Super Admin see every trade and can filter Active Requests by All trades, My trades, or one shift.
- The other person must click Accept. Deny needs a reason. Only that person can accept or deny.
- Scheduler Settings → Trades has three checkboxes, all starting off: Admin approval for trades, Payback required, Require approval before cancelling a trade. They are department payload flags `tradeAdminApproval`, `tradePaybackRequired`, and `tradeCancelApproval`.
- Payback required on a new request starts from that department setting. The sender can change it for one request. When it is off, Date You Work Instead is gray. When a payback date is entered, Step 12 puts the requester on that day in the other person's place for the same hours.
- With admin approval on, Accept sets status `awaiting_admin`. A sub admin or above then Approves (`accepted`) or Denies (`admin_denied`, reason required). With it off, Accept sets `accepted`.
- Before a request is saved, the other person is checked against the truck for those hours. Someone already on that truck can move into the seat being given up when they hold that qualification, and the new person must meet the seat that move opens. A higher qualification can cover a lower seat. Injury / Vacation / Sick / Kelly Day and overlapping hours are reported before the qualification message. Chief on Call does not block. If the requester is not on a seat for those hours, only leave and overlap are checked.
- When the trade becomes accepted, the split is written on the schedule. Someone who already works the whole shift and can fill a higher seat moves there for the entire shift, and that seat is not split. Only the hours that still change people are listed on Trades. Payback runs the same checks and uses the same rule. The previous schedule day is kept in `scheduleChangeJson`.
- Cancel approval is the Trades checkbox Require approval before cancelling a trade. Either person requests the cancel on an accepted trade. The other person accepts. An admin approves too when that box is on. Then both days go back to the saved previous schedule. The person who asked to cancel cannot accept their own request. Keep Trade needs a reason and does not change the schedule.
- Your Assigned Date can be typed or picked from days the person is already on a truck or a split piece. Support rows such as Injury are not scheduled-work days. On November 3, Joshua was on `8a-8p` for 2026-11-01, 03, 05, 06, 07, and 09.
- Trade With lists Scheduler Settings → Personnel except the signed-in person. Both people need a sign-in account. You cannot trade with yourself.
- Times are typed in 24-hour form. `8` or `0800` becomes `08:00`.

## Current blocker / status
- November 4, 11:45 a.m.: Steps 5 and 6 are closed by the user (overtime length is the Overtime Setup setting; Stage D tests covered the re-test). Step 3 goes under Recurrence → Custom. Stage E, Steps 14–19, was added from the user's notes: Department Apparatus window width, view-only schedule without Edit the schedule (`schedule.edit` already blocks the save on the server; trades use `/api/trades` and must keep working), per-seat qualifications in Scheduler Apparatus, Request Admin Permission override, Trades form cleanup, and Select Scheduled Day listing roster days (today it lists only days saved on the server).
- User answers (November 4): Step 3 Custom offers 'every N days' or weekday checkboxes. Step 15: without `schedule.edit`, clicking a day block does nothing. Step 17: Sub Admin and above approve; the person sits in the seat marked Pending; each overridable qualification names one allowed lower qualification; a new request table is approved (local `fu_local` first). Still open: where admins see override requests (Step 17) and how far ahead Select Scheduled Day lists (Step 19, suggested 3 months), plus Holidays.
- Step 13 click-test passed on November 4, 2026.

## Now vs later
- **Now:** explain Step 3 and wait for approval. The proposed control is a Selected weekdays choice with Monday–Sunday checkboxes, saved in the existing shift settings. The calendar shows only the checked days. A shift that does not use it keeps today's days, including a 24/48 rotation.
- **Later:** Steps 4 and 5 (rotation start date, then hour and overtime rules). Staging is Step 7 and comes only after the user asks.

## Next agent should do this first
1. Stay on `cursor/watseka-scheduling-plan`. Read this file, the November 3 session note, and the session summary.
2. Read `docs/plans/canvases/weekday-schedule-test-plan.canvas.tsx` Stage B Step 3 before editing.
3. Do not rebuild Steps 8–13. Do not write Step 3 code until the user approves the wording and layout.
4. After they approve it, implement Step 3 only. The calendar for this test shift shows Monday–Friday. A 24/48 shift still shows the same days as before. No Prisma schema change.
5. Update this file, the session note, the conversation summary, and the repo canvas together. Republish the canvas to id `07bcb2d0-f8d5-448e-9b16-a5473b749ecc`. Do not put a password in it.
6. Pull request #36 is the trades work. Do not merge it until the user asks.
