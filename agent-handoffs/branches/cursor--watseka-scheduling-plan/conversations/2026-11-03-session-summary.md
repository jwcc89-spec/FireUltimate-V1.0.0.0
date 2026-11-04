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
- Cancelling needs the other person to agree. A department can also require an administrator before the schedule goes back. That button is now on an accepted trade.
- Members see only their own trades. Sub Admins, Admins, and Super Admins see every trade and can show all trades, their own trades, or one shift.
- Trade With lists people from Scheduler Settings → Personnel. Your Assigned Date can be typed or chosen from days that person is already scheduled.

## Built
- The Trades page talks to the server. A request reaches the other account.
- The three Trades settings save with the department.
- The request form uses the roster, scheduled days, 24-hour times, and the payback setting.
- If admin approval is on, Accept waits for a Sub Admin or above. Approve and Deny show for those roles. The calendar does not change yet.
- A request is stopped before it is saved when the truck cannot be covered for those hours, the other person already works those hours, or that person is on Injury, Vacation, Sick, or Kelly Day. The reason pops up in the center of the screen. Someone already on the truck can move into a higher seat when they hold that qualification. The new person must meet the seat that opens. A person with a higher qualification can cover a lower seat.
- Accept, or Approve when admin approval is on, splits the schedule. Deny does not. The Trades row on the schedule lists the hours that still change people. A person who already works the whole shift and can fill a higher seat stays there all day. Payback puts the requester on the other person's seat for the same hours.
- Cancel Requested Trade is on an accepted trade for either person. The other person accepts the cancellation. If the department requires approval before cancelling, an administrator approves before the days go back.

## Not built yet
- Monday–Friday only. Daily still includes Saturday and Sunday.

## Click-test that passed
Steps 8 through 12. The seat move works. After Joshua trades 08:00–10:00 with Kenny, Lance stays in the top seat for the whole shift. The lower seat is Kenny, then Joshua. The Trades row lists those two pieces.

## Click-test still open
Pull the latest branch, restart the local API (not `npm run proxy`), and refresh http://localhost:5173. Leave the three Trades checkboxes off for the first pass. Use the accepted November 5 trade from Step 12: Lance in the top seat all day, Kenny then Joshua in the lower seat. Close the Schedule page before you cancel, so an open schedule does not save the old split back over the restore.

1. Sign in as wicj. Personnel → Trades. On that accepted trade, click Cancel Requested Trade. The status becomes Waiting on Kenny Baier to accept the cancellation. Open Schedule and confirm November 5 is still the split day.
2. Sign in as baik. Personnel → Trades. Click Accept Cancellation. The status becomes Cancelled, and a message says to open Schedule and refresh it.
3. Open Personnel → Schedule for November 5 and refresh the page. Joshua is in the top seat for 08:00–20:00. Lance is in the lower seat for the whole shift. The Trades row for that trade is gone.
4. If a payback day was changed by a trade you cancel the same way, that day also returns to the names from before the trade.
5. Turn on only Require approval before cancelling a trade. Accept a new short trade, then Cancel Requested Trade, and have the other person click Accept Cancellation. The status becomes Waiting for admin approval to cancel, and the schedule stays split. Sign in as admin and click Approve Cancellation. Then refresh Schedule. Both days are back. Turn that checkbox off when you are done.

Tell the next agent what matched and what did not. The next build step waits on that.

## Safety
- Do not run `npm run proxy` for this test. That command uses the staging database.
- The local database is `~/fu-local-db` on port 5433.
- The admin password was changed. Do not reset it.
