# Agent Handoff Note

## Session metadata
- Date: 2026-11-01, about 3:10–4:30 p.m. America/Chicago
- Agent type: Cursor desktop (Claude Opus 5.5)
- User request focus: Review the Phase C Fire Recovery plan, find everything about Fire Recovery in the repo, ask questions, and write a detailed plan so billing can go live Monday, November 2.
- Working branch: `cursor/stage-b-foundation-b5ff`

## Work completed (documentation only)
- **`docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md`:** the detailed Stage C plan and the source of truth. It started as a local Cursor plan file, which other agents cannot see. It covers:
  - decisions (§3)
  - the Recovery Hub-style billing form (§5)
  - requirement levels (§6)
  - server and front-end design (§7–8)
  - waves with checkboxes (§9)
  - operator steps (§11)
  - the vendor email (§13)
  - open questions (§14)
  - a note to move the plan to `docs/plans/completed/` when finished
- **Vendor docs:** Fire Recovery's full published API documentation (Postman collection, no credentials) saved as `docs/procedures/vendor/fire-recovery-usa-api-collection-2026-11-01.json`.
- **Reference image:** a blank Recovery Hub screenshot saved as `docs/plans/assets/phase-c-fire-recovery/recovery-hub-create-motor-vehicle-incident-blank.png`. An earlier screenshot from the user showed a real person's name, address and plate; it was **not** committed.
- **Updated to match the plan:**
  - `docs/procedures/FIRE_RECOVERY_USA_API_REFERENCE.md`
  - `docs/plans/canvases/repair-plan.canvas.tsx` (repo copy; the live canvas was not republished)
  - `docs/task-2-multitenant-domain-plan.md`
  - `ACTIVE_CONTEXT.md`

## Decisions
The plan's §3 is the final list. The earlier chat ideas about driver-only parties, Is Owner / Is Driver checkboxes, and removing "Owner - Insurance Company" were **cancelled**: billing has its own tab, and Person/Owner stays unchanged.

## Findings for the build (also in plan §2.1)
- Since security fix 5, the export receipt holds only the NERIS payload, so the billing mapping receives no `formValues`. The plan reads the server-saved, Exported report instead (§7.1).
- A failed submit sets `lastSubmitOk: false` on a row that already has a good tracking ID.
- Errors after the vendor accepted a bill are stored as failures, which invites a double bill. These become "Needs review".
- The client accepts any reply with a TrackingId; it must also require `Status === 1`.
- Person/Owner vehicle links use list positions, which shift when a person is deleted.

## Operator status
- The Welcome email has the RH public API login (host `https://process.firerecoveryusa.com`).
- The billing agreement is set up.
- `FIRE_RECOVERY_CREDENTIAL_KEY` is missing on staging and production.

## Verification
- Documentation only; no app or server code changed. `npm run lint` passed.

## Next steps for next agent
1. Get the operator's answers to plan §14 (Q1 and Q2 before Wave 4; Q3 and Q4 before Wave 3).
2. Start at Wave 1 once the operator says to start building.
3. Do not touch Render, Neon, or production. The operator creates the Render settings (§11.1).
