# November 3, 2026 — weekday schedule and trades

Branch `cursor/watseka-scheduling-plan`. The backup on GitHub before this note was commit `5696329`. America/Chicago.

## What this day was
The scheduler is being tested for a paid-on-call department that works 08:00–20:00 on weekdays. Testing stays on a throwaway database on this Mac. Staging, production, and Crescent stay untouched.

The schedule changes made earlier in the day were accepted. Then Personnel → Trades was planned and the first three trade steps were built.

## Decisions
- Trades are stored in a new database table, one row per request. That structure change was approved.
- The other person always clicks Accept or Deny. Deny needs a reason.
- A department can also require an administrator to approve. That switch is Admin Functions → Scheduler Settings → Trades.
- Payback required starts off. The department can turn it on so new requests start checked. The person sending a request can still change that one request. If it is unchecked, Date You Work Instead is gray.
- When payback is used, a later step puts the requester on that date in the other person's place for the same hours.
- Cancelling needs the other person to agree. A department can also require an administrator before the schedule goes back. The Cancel button is not built yet.
- Members see only their own trades. Sub Admins, Admins, and Super Admins see every trade and can show all trades, their own trades, or one shift.
- Trade With lists people from Scheduler Settings → Personnel. Your Assigned Date can be typed or chosen from days that person is already scheduled.

## Built
- The Trades page talks to the server. A request reaches the other account.
- The three Trades settings save with the department.
- The request form uses the roster, scheduled days, 24-hour times, and the payback setting.
- If admin approval is on, Accept waits for a Sub Admin or above. Approve and Deny show for those roles. The calendar does not change yet.

## Not built yet
- Stopping a request when the other person is not qualified, already working, or on Injury, Vacation, Sick, or Kelly Day.
- Putting an accepted trade onto the schedule.
- Cancelling a trade and putting the days back.
- Monday–Friday only. Daily still includes Saturday and Sunday.

## Click-test still open
Refresh http://localhost:5173 once.

1. Sign in as admin. Admin Functions → Scheduler Settings. The Trades card should read approval Off, payback not required, cancel approval Off.
2. Sign in as wicj. Personnel → Trades. Trade With should list Landon, Lance, and Kenny, not Joshua. Scheduled days should include November 1, 3, 5, 6, 7, and 9. Type November 4 as well, then set the date back to November 5.
3. Send Landon 08:00–10:00 on November 5 with Payback required off. Date You Work Instead stays gray.
4. Lance sees no trades. Landon can Accept. The status becomes Accepted. November 5 on the calendar stays unchanged.
5. As admin, the Show list switches among All trades, My trades, and 8a-8p.
6. Turn on all three Trades checkboxes. As Joshua, Payback required starts checked and two notes explain admin approval and cancellation. Send Landon November 6, 08:00–12:00, payback November 12.
7. Landon Accepts. Status becomes Waiting for admin approval. Landon has no Approve button.
8. Admin Deny with an empty reason asks for a reason. Deny with `Coverage already set`. Status becomes Denied by admin.
9. Turn all three Trades checkboxes off again.

Tell the next agent what matched and what did not. The next build step waits on that.

## Safety
- Do not run `npm run proxy` for this test. That command uses the staging database.
- The local database is `~/fu-local-db` on port 5433.
- The admin password was changed. Do not reset it.
