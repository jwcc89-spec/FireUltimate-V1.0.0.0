# Copy/Paste Start Prompt (cursor/stage-b-foundation-b5ff)

When a new agent starts and the user says **"read the COPY_PASTE_START_PROMPT for this branch"**, read this file first, then the docs below.

The agent states at the end of each response **which agent/model was used**. The user does not record that.

**Branch:** `cursor/stage-b-foundation-b5ff`  
**Slug:** `cursor--stage-b-foundation-b5ff`  
**Pull request 31:** https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31 — **merged** into `submenu/neris-golive-cifpd` at `d4bbaee` on 2026-11-01. Do not merge it again.

**Where the program is (2026-11-04, evening America/Chicago):**
- Staging (`https://cifpdil.staging.fireultimate.app`, Render `fireultimate-api-staging`) runs `submenu/neris-golive-cifpd` (feature tip through `b52c3a4` and later). Crescent staging click test passed 2026-11-01 ~2:09 p.m.
- Production (`main`) is at `6efda0e` (PR #37, 2026-11-04). It has the full Stage B security stack from the November 1–2 sessions and Stage C Fire Recovery *code*. Leave `FIRE_RECOVERY_MODE` unset. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` until Wave 7/8.
- This practice branch is for Fire Recovery Wave 7/8 notes and parked follow-ups. Do not rebuild Stage B.

**Relevant docs to read (in order):**
1. `cursoragent-context.md` — session handoff workflow and branch rules
2. `.cursor/project-context.md` — project constraints and 24-hour time
3. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/ACTIVE_CONTEXT.md` — current focus. Trust this file over older session notes.
4. `docs/plans/security-remediation-plan.md` — trust the **Status** line. Stage B is on staging and production.
5. `docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md` — Wave 7 is next when the user asks
6. `docs/task-2-multitenant-domain-plan.md` — Now vs Later
7. `docs/plans/canvases/repair-plan.canvas.tsx` — repair plan source. Live canvas may lag: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136
8. `docs/procedures/RELEASE_CHECKLIST.md` — release wording
9. `docs/system_architecture.md`, `docs/data_model.md`, `docs/incident-lifecycle.md`, and `docs/integrations.md` when touching architecture, data, incidents, reports, export, CAD, NERIS, or NEMSIS

October 31–November 1 session files that say "production is not updated" are history. Trust the live security plan Status line.

**Sessions vs conversations (this branch):**

| Folder | Audience | Content | Count per working session |
|--------|----------|---------|---------------------------|
| **`sessions/`** | Next agent | What shipped, paths, commands, verification, next steps | **One** session note — do **not** add a new file for every sub-task in the same session |
| **`conversations/`** | User | Condensed summary of the **full** conversation (decisions, outcomes, what to test) | **One** file: **`YYYY-MM-DD-session-summary.md`** |

**Hard stops until the user says otherwise:**
- Do not rebuild Stage B, security fixes 1–15, Part 0, or the Allowed Senders screen. They are on staging and production.
- Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` or set `FIRE_RECOVERY_MODE` on Render until Wave 7/8. Do not save a Fire Recovery password in production until then.
- Before production CAD ingest is relied on, add Crescent’s dispatch sender to production Allowed Senders (list was empty after the 2026-11-04 promote).
- Do not build the parked items: Recover Reports, incident Status (drop Draft), Configure Table drag, left-menu hiding, canceled-en-route time fill, or per-user Edit My Display.
- Do not upgrade Prisma. Stay on 7.10.1. Do not change `.npmrc` `engine-strict=true`. Do not raise Render to Node 22.
- Staging and production build command: `npm ci --engine-strict=false && npm run build`. Do not add a dashboard `NODE_ENV` variable.
- Do not put auth secrets in `DepartmentDetails.payloadJson`.
- Keep the demo tenant persistent. Do not run seed or `migrate reset`.
- Tests use only `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable`. Never Neon.
- Do not delete Crescent's staging sender `dispatch@co.iroquois.il.us` (id `allow-cifpdil-dispatch-20261101`). CAD mailbox is `cifpdil@cad.fireultimate.app`.
- Leave Neon backups alone: `backup-2026-11-01-before-stage-b`, `backup-2026-11-04-before-weekday-schedule`, `backup-2026-11-04-before-production-weekday`.
- Do not republish the live repair-plan canvas unless the user asks.

---

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: cursor/stage-b-foundation-b5ff unless I explicitly tell you to switch.
2) Use branch slug: cursor--stage-b-foundation-b5ff in paths under agent-handoffs/branches/cursor--stage-b-foundation-b5ff/
3) Read continuity docs:
   - cursoragent-context.md
   - .cursor/project-context.md
   - agent-handoffs/branches/cursor--stage-b-foundation-b5ff/ACTIVE_CONTEXT.md
   - docs/plans/security-remediation-plan.md (trust the Status line)
4) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md
   - docs/plans/canvases/repair-plan.canvas.tsx
   - docs/system_architecture.md, docs/data_model.md, docs/incident-lifecycle.md, and docs/integrations.md when the task touches them
5) Before coding, summarize:
   - current branch and latest commit
   - Stage B is on staging and production (PR #37 / 6efda0e). Stage C code is on both; billing is off.
   - Next Fire Recovery step is Wave 7 staging sandbox when the user asks.
   - parked: Recover Reports, incident Status (unit status, drop Draft later), Configure Table drag, left-menu hiding, canceled-en-route time fill, per-user Edit My Display
   - Now vs Later
6) Follow beginner-friendly communication: numbered where / click / type / expect. 24-hour time.
7) After meaningful changes:
   - update this session's single note in agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/
   - keep ACTIVE_CONTEXT.md current
   - update the repair plan canvas source. Republish canvas id 3b7445ce-b395-4e16-b948-f84dab1ca136 only if I ask.
8) Before stopping:
   - update ACTIVE_CONTEXT.md
   - finalize this session's sessions note
   - add or refresh one conversations/YYYY-MM-DD-session-summary.md
   - commit and push on cursor/stage-b-foundation-b5ff only when asked
   - report branch, commit hash, changed files, and the next-step checklist
   - end with which agent/model answered

After acknowledging the rules above:
1) Wait for my next request. Do not rebuild Stage B.
2) Do not create FIRE_RECOVERY_CREDENTIAL_KEY. Do not save a Fire Recovery password in production.
3) Do not build the parked items.
4) Do not set FIRE_RECOVERY_MODE until Wave 7/8.
```
