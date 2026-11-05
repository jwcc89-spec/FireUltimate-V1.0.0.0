# November 3, 2026 — weekday schedule and trades

Branch `cursor/watseka-scheduling-plan`. America/Chicago. The session ran November 3 and ended about 1:00 a.m. on November 4. The readable plan is [Scheduling — weekday 12-hour department test](https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/07bcb2d0-f8d5-448e-9b16-a5473b749ecc).

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
- If admin approval is on, Accept waits for a Sub Admin or above. The schedule changes when the trade becomes accepted.
- A request is stopped before it is saved when the truck cannot be covered for those hours, the other person already works those hours, or that person is on Injury, Vacation, Sick, or Kelly Day. The reason pops up in the center of the screen. Someone already on the truck can move into a higher seat when they hold that qualification. The new person must meet the seat that opens. A person with a higher qualification can cover a lower seat.
- Accept, or Approve when admin approval is on, splits the schedule. Deny does not. The Trades row on the schedule lists the hours that still change people. A person who already works the whole shift and can fill a higher seat stays there all day. Payback puts the requester on the other person's seat for the same hours.
- Cancel Requested Trade is on an accepted trade for either person. The other person accepts the cancellation. If the department requires approval before cancelling, an administrator approves before the days go back.

## Not built yet
- Monday–Friday only. Daily still includes Saturday and Sunday.

## Click-test that passed
Steps 8 through 13. The seat move works. After Joshua trades 08:00–10:00 with Kenny, Lance stays in the top seat for the whole shift. Cancelling that trade, after the other person accepts, puts Joshua back on the top seat for the whole shift and Lance back on the lower seat. The Trades lines for that split are gone.

## Decision still open
Step 3, Selected weekdays. The session ended before any of that code was written. No code until you approve the wording and the checkbox layout. A shift that does not use it, including a 24/48 shift, must keep the days it shows today.

Stage A is done, including the from-scratch department setup.

## Safety
- Do not run `npm run proxy` for this test. That command uses the staging database.
- The local database is `~/fu-local-db` on port 5433.
- The admin password was changed. Do not reset it.
