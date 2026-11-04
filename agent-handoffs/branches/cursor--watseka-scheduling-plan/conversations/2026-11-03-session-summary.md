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
- A request is stopped before it is saved when the truck cannot be covered for those hours, the other person already works those hours, or that person is on Injury, Vacation, Sick, or Kelly Day. The reason pops up in the center of the screen. Someone already on the truck can move into a higher seat when they hold that qualification. The new person must meet the seat that opens. A person with a higher qualification can cover a lower seat.
- Accept, or Approve when admin approval is on, splits the schedule. Deny does not. The Trades row on the schedule lists the hours. Payback puts the requester on the other person's seat for the same hours.

## Not built yet
- Cancelling a trade and putting the days back. The previous day is already saved on the trade for that step.
- Monday–Friday only. Daily still includes Saturday and Sunday.

## Click-test that passed
Steps 8, 9, 10, and 11. The seat move works: Joshua in the paramedic seat can trade with Kenny when Lance, also a paramedic, is in the lower seat.

## Click-test still open
Pull the latest branch, restart the local API, and refresh http://localhost:5173. Admin approval for trades should be off.

1. Sign in as wicj. Put Joshua in the top paramedic seat and Lance in the lower seat on November 5. Personnel → Trades. Submit 08:00–10:00 with Kenny, payback off.
2. Sign in as Kenny's account. Personnel → Trades. Click Accept. The status becomes Accepted.
3. Open Personnel → Schedule for November 5. Lance stays in the paramedic seat for the whole shift, with no time split on that seat. The lower seat is Kenny from 08:00–10:00 and Joshua from 10:00–20:00. The Trades row lists those two pieces, such as `BAIK: 8A-10A` and `WICJ: 10A-8P`. Lance does not get a timed line.
4. Send a second trade with Payback required on, payback date a day Landon is scheduled, same hours. After Accept, that payback day shows Joshua in Landon's seat for 08:00–10:00 and Landon keeps the rest.
5. Put Joshua on Injury on a payback day and try to accept a trade that uses that date. The centered message starts with `On the payback date,` and the schedule does not change.

Tell the next agent what matched and what did not. The next build step waits on that.

## Safety
- Do not run `npm run proxy` for this test. That command uses the staging database.
- The local database is `~/fu-local-db` on port 5433.
- The admin password was changed. Do not reset it.
