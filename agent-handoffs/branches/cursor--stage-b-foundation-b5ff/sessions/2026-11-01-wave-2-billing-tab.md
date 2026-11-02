# Agent Handoff Note

## Session metadata
- Date: 2026-11-01, about 6:51–7:15 p.m. America/Chicago
- Agent type: Cursor desktop (Grok 4.7)
- User request focus: Continue Stage C after Wave 1 review. Build Wave 2 only, then stop.
- Working branch: `cursor/stage-b-foundation-b5ff`
- Commit: the Wave 2 commit on this branch. Run `git log -1` after pull. Not deployed.

## Work completed
- Wave 2 Fire Recovery Billing tab, on the practice branch only.
- `src/fireRecovery/billingRequirements.ts` holds the billing shape, the three motor-vehicle type check, copy-from-Person/Owner, city and personnel helpers, and the missing-field list.
- Copy stores the person's or owner's name and address at copy time. It does not store `person:0` or `owner:1`.
- `src/nerisMetadata.ts` adds section `fireRecoveryBilling` after Person/Owner and field `fire_recovery_billing_json`. The field is not required for NERIS.
- `src/pages/FireRecoveryBillingSection.tsx` is the form. `NerisReportFormPage.tsx` shows it only when the primary or an additional type is one of the three motor-vehicle types. In Review and Exported reports are read-only. Print adds a Fire Recovery Billing summary and skips the raw JSON.
- Admin Functions → NERIS Required Fields has a Fire Recovery Billing group. Save stores `fireRecoveryFieldRequirements` in department details. Is Resident stays Recommended until a department sets it to Required. Uninsured waives the insurance company.
- Change history uses the field label "Fire Recovery Billing" from the metadata.
- `server/neris-proxy.mjs` does not contain `fire_recovery_billing_json`. A unit test fails if that string appears. NERIS export is unchanged. The vendor mapping is still the old short payload (Wave 3).
- Form Filed By is counted missing until a later wave supplies the exporter's name. The chip can say that field is missing on a Draft. That matches "you cannot bill until the report is exported."
- Plan Wave 2 boxes are ticked. A line was added to plan §15.
- Repair-plan canvas repo copy, task-2 plan, and the Fire Recovery API reference were updated. The live canvas was not republished.

## Verification
- `npm run lint` passed (existing note that `App.tsx` exceeds 500 KB).
- `npm run build` passed (existing chunk-size warning only).
- `npm test` 33 passed, including the session test, against local `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable` only. Throwaway Postgres was stopped afterward.
- The billing tab was not clicked in a browser. The user had closed both terminals. This Mac's API writes the staging database, so the tab was not opened against a live report.

## Not done
- Wave 3 and later. Server-side required-field enforcement and the vendor mapping rewrite are Wave 3.
- No Render, Neon, Cloudflare, staging, or production change. No settings save and no bill submit.
- `FIRE_RECOVERY_MODE` and `FIRE_RECOVERY_CREDENTIAL_KEY` were not created on Render.
- Did not merge to `main`. Did not open a pull request.

## Follow-up the same evening
- The operator confirmed the motor-vehicle tab appears, and reported that Validate did not require the Fire Recovery fields.
- `billingValidationIssueLabels` now feeds the NERIS Validate button for a billable incident type.
- Missing Required fields keep the report on Draft. Recommended fields do not. Form Filed By is omitted because it is filled from the exporter.
- The Export button still does not check billing fields.

## Follow-up: labels, clear time, personnel
- Required Fire Recovery labels use the same ` *` mark as Core and Medical. Recommended and optional labels have no asterisk. Uninsured removes the insurance asterisk.
- Time Call Cleared reads Incident clear time first. If that is blank, it uses the latest clear time on a Resources unit that was not canceled. If that is also blank, it uses Incident Times unit clear time.
- Total Personnel On-Scene counts distinct people selected on Resources units that were not canceled en route.

## Follow-up: tab name and copy
- The NERIS section label is Motor Vehicle Collision. The helper sentence, the "Create Motor Vehicle Incident for {department}" heading, the required/recommended legend, and the red and orange field bars are removed.
- Copy from Person/Owner makes one party per vehicle and fills the name from the vehicle's person link. If that link is missing, it uses the next person or owner. People who are not paired with a vehicle are copied as extra parties. A vehicle with no people is still copied.

## Follow-up: per-party copy and Wave 3
- Each party card has Copy from Person/Owner. The person picks one person or owner. A linked vehicle fills the vehicle fields. The old Replace-all button is gone.
- Wave 3: `buildFireRecoveryPayload` in `server/fireRecoveryMapping.mjs`. Submit loads the Exported draft. Missing required fields return 400 before the vendor call. Tests: `server/fireRecoveryMapping.test.mjs`. `npm test` 40 passed on local `fu_session_test`.

## Next
1. Wait for the user's review of Wave 3.
2. After they say to continue, start Wave 4 (preview, lock, submit status columns). Stay on this branch. Pull first.
3. Do not create the Render settings until Wave 7.
4. Do not run `npm run db:seed`. Do not ask for the staging password.
