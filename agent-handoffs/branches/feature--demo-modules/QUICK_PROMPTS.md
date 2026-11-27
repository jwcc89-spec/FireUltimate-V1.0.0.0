# Quick prompts — feature/demo-modules

## Start prompt (paste into a new agent chat)

Copy everything below the line.

---

Which branch am I working on? **feature/demo-modules** (merge finished work into `submenu/neris-golive-cifpd` for staging at `https://cifpdil.staging.fireultimate.app`).

You are continuing the FireUltimate demo-week build. Prefer the same plain-language style as the Claude W0/W1/Apparatus work.

### Read first (in order)
1. `agent-handoffs/branches/feature--demo-modules/ACTIVE_CONTEXT.md`
2. `docs/plans/demo-week-build-plan.md` — especially **"Handoff for the next agent"** and every **"as built" / follow-up** note (those override older step text)
3. `cursoragent-context.md`, `.cursor/project-context.md`, `docs/agent-execution-contract.md`
4. Latest session note: `agent-handoffs/branches/feature--demo-modules/sessions/2026-11-26-evening-followup.md`

### Current state (do not re-do)
- W0–W4 are done and on staging. **23/23 migrations applied.** Staging tip includes evening follow-up merge `70781fa`.
- Evening follow-up already shipped: 1s takeover pulse; takeover seconds 10–600 per board; road map default on CallMap; incident breadcrumb 3 levels; inspection Save draft; equipment OOS syncs to Equipment List; sidebar collapse fix; Checklists Templates/Assignments/Kits admin-only.

### Your next work
1. Confirm with me that evening follow-up (and any leftover W4) click checks passed, or fix what I report.
2. Default next build step: **W5 Dashboard** from the demo plan (drag/resize widgets, saved layouts). Restate scope, files, and whether a migration is needed; **wait for me to say go**.
3. If I prioritize instead: Units + In Reserve / apparatus profile, or maintenance labor — those need **schema approval** first. Show the migration; do not apply or merge until I approve. Full Groups/permissions is out of the demo rush; a demo-sized labor pick-list is OK if I approve.

### Hard rules
- Operator tests on staging only — never ask for local `npm run dev` unless there is no other way. Give numbered staging click checks.
- Do not change NERIS export / NerisDraft, sign-in/session, or store secrets in `payloadJson`. Always filter by `request.tenant.id`. 24-hour time only.
- No Prisma schema / migration / auth changes without my explicit approval. Apply migrations to staging **before** merging code that needs them into `submenu/neris-golive-cifpd`.
- Work in small batches; `npm run lint` and `npm run build` after each; keep `npm test` green aside from the two known local-Postgres failures.
- Demo menu items stay `isBuilt: false` until the real page works. Match existing page-section / panel / EditDialog / ModuleTable patterns.
- Update ACTIVE_CONTEXT + a session note every session. End every response with **Agent used for this response:** and the agent name.

Start by confirming the branch, restating W5 (or whatever I prioritize), and listing risks. Do not edit until I say go.
