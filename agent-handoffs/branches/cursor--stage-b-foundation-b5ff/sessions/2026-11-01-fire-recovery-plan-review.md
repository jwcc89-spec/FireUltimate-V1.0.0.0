# Agent Handoff Note

## Session metadata
- Date: 2026-11-01, about 3:10–3:40 p.m. America/Chicago
- Agent type: Cursor desktop (Claude Opus 5.5)
- User request focus: Review the Phase C Fire Recovery plan, find everything about Fire Recovery in the repo, ask questions so billing can go live in 24 hours.
- Working branch: `cursor/stage-b-foundation-b5ff`

## Work completed (documentation only)
- Saved Fire Recovery's full published API documentation (Postman collection, no credentials) as `docs/procedures/vendor/fire-recovery-usa-api-collection-2026-11-01.json`.
- `docs/procedures/FIRE_RECOVERY_USA_API_REFERENCE.md`: vendor notes (send Narrative and RespondingUnits, nested shapes, date format, no required fields listed, Status 1 success check), new reporting and invoice endpoints, and today's field decisions.
- `docs/plans/canvases/repair-plan.canvas.tsx` (repo copy; the live canvas was not republished): Steps 11–15 and 18, 11 new Decisions rows, Still open, and the vendor email questions.
- `docs/task-2-multitenant-domain-plan.md`: Fire Recovery decisions (2026-11-01).
- Stage C plan rewritten for the Monday go-live and saved in the repo as `docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md` (source of truth). It started as a local Cursor plan file, which other agents cannot see.

## Decisions (user, 2026-11-01)
- **Go-live:** one real Crescent bill from production by Monday, November 2. It slips if the staging sandbox test hasn't passed.
- **Scope:** vehicle accidents only.
- **Sandbox protection:** a Render setting forces `FD12345678` on staging, and production refuses it. No database change.
- **Parties:** one per vehicle, the driver; passengers are not sent.
  - **Required:** driver name and address, Is Resident (lives in the fire district; always sent), vehicle make and model, vehicle insurance company.
  - **Optional:** At Fault. The vendor's Owner flag comes from the vehicle's persons involved.
- **Insurance field:** remove "Owner - Insurance Company" and copy its values into "Vehicle Insurance - Company Name" when that field is blank.
- **Unclear vendor reply:** shows "Needs review: check Recovery Hub", and resending is blocked until an admin clears it.
- **Older incidents:** a button exports the report to NERIS again, then opens the billing preview.
- **Permissions:** officers will be granted billing (both billing.submit and billing.view).
- **Display:** billing status is also shown in the NERIS report's export view.

## Findings for the build
- A failed submit sets `lastSubmitOk: false` on a row that already has a good tracking ID, so a billed incident looks unsent (`server/neris-proxy.mjs`, submit catch block).
- Any error after the vendor accepted a bill is stored as a failure. That invites a double bill unless it becomes "Needs review".
- `postAddNerisIncidentForBilling` accepts any reply with a TrackingId. It should also require `Done["API Response"].Status === 1`.
- Vehicle `personsInvolved` stores references `person:N` / `owner:N`. No field marks the driver; Person "Affiliation" is free text.
- Get Incident Tracking Id still needs a SubscriptionKey, so "Needs review" is resolved by hand in Recovery Hub for now.

## Verification
- Documentation only; no app or server code changed. `npm run lint` passed. A build was not needed.

## Next steps for next agent
1. Get the user's answer on how the driver is marked.
2. Get approval to start the Stage C build in the order of the Cursor plan.
3. Do not touch Render, Neon, or production. The user creates the Render settings.
