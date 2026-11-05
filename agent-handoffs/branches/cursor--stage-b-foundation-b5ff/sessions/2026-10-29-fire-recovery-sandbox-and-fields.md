# Agent Handoff Note

## Session metadata
- Date (UTC): 2026-10-29
- Agent type: Cloud
- User request focus: Record Fire Recovery's sandbox instructions and field requirements; record the remaining decisions.
- Working branch: `cursor/stage-b-foundation-b5ff`

## Work completed
- Canvas updated in place (Steps 12, 13, 15, 17, 23; Decisions tab; Data safety; scheduling note) and its repo copy re-synced (verified identical).
- `docs/procedures/FIRE_RECOVERY_USA_API_REFERENCE.md`: sandbox-in-production instructions, current NERIS billing request shape including `Parties[]`, the department's minimum fields, and the current mapping gap.
- `docs/task-2-multitenant-domain-plan.md`: decisions and remaining open items.

## Findings
- Fire Recovery testing uses `https://process.firerecoveryusa.com` with sandbox department ID `FD12345678`. The app currently sends the tenant's `nerisEntityId` as `NERISDepartmentId` (`server/neris-proxy.mjs`), so a staging test would send Crescent's real ID. Step 13 adds a separate Fire Recovery department ID and a staging guard.
- Report form gaps (Step 15): no `law_enforcement_number` form field (the mapping falls back to `dispatch_final_disposition`); no "Is Resident" field; Person/Owner vehicle fields are not required and are not mapped to billing. The vehicle record has a per-vehicle `policeReportFileNumber` and `personsInvolved`.

## Verification
- Documentation only; lint, build and tests re-run before commit.

## Next steps for next agent
1. Get explicit approval for Step 5 (auth) before editing.
2. Do not run any Fire Recovery submission from staging until Step 13's sandbox-ID guard exists.
