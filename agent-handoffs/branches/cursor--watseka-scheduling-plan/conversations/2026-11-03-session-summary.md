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

## Not built yet
- Putting an accepted trade onto the schedule. The payback day is checked then, not now.
- Cancelling a trade and putting the days back.
- Monday–Friday only. Daily still includes Saturday and Sunday.

## Click-test that passed
Steps 8, 9, and 10. The department was put back with all three Trades boxes off.

## Click-test still open
Refresh http://localhost:5173 once. Sign in as wicj (Joshua). Open Personnel → Trades.

1. Pick a day Joshua is on a seat, and a person who is free that day and meets that seat. November 5, 08:00 to 10:00, Landon LeDuke, payback off, is the example if Landon is not already working those hours and not on Injury, Vacation, Sick, or Kelly Day. Click Submit Trade Request. The request appears in Active Requests.
2. Put Landon on Injury for that same day (open that day on the schedule and add him on the Injury row). Submit the same request again. The centered message is: `Landon LeDuke is on Injury. Remove them from Injury before scheduling them on apparatus.` The new request is not added. Vacation, Sick, and Kelly Day use the same sentence with that row's name.
3. Remove Landon from Injury. Place Landon on a truck for 08:00–20:00 that day, or for any hours that include 08:00–10:00. Submit again. The message is: `Landon LeDuke already assigned to [truck name]. Remove or segment assignments so times do not overlap.` Remove him, or pick hours he is not working, and the request can send.
4. Joshua must be on the seat that day or this check is skipped. If that seat requires a qualification nobody staying on the truck can cover, the message is: `Cannot assign Landon LeDuke: does not meet required qualification for that segmented slot.` If that seat has no required qualification, this message will not appear. That is expected.
5. Put Joshua in the top paramedic seat and Lance, also a paramedic, in the lower seat. Submit 08:00–10:00 with Kenny (EMT-B). The request is saved. Kenny is allowed because Lance can move to the paramedic seat. If Lance is not a paramedic, the same request is refused.

Tell the next agent what matched and what did not. The next build step waits on that.

## Safety
- Do not run `npm run proxy` for this test. That command uses the staging database.
- The local database is `~/fu-local-db` on port 5433.
- The admin password was changed. Do not reset it.
