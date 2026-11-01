# Copy/Paste Start Prompt (cursor/stage-b-foundation-b5ff)

When a new agent starts and the user says **"read the COPY_PASTE_START_PROMPT for this branch"**, read this file first, then the docs below.

The agent states at the end of each response **which agent/model was used**. The user does not record that.

**Branch:** `cursor/stage-b-foundation-b5ff`  
**Slug:** `cursor--stage-b-foundation-b5ff`  
**Pull request:** https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31 (base `submenu/neris-golive-cifpd`). **Do not merge.** Do not point staging or production at this branch.

**Relevant docs to read (in order):**
1. `cursoragent-context.md` — session handoff workflow and branch rules
2. `.cursor/project-context.md` — project constraints and 24-hour time
3. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/ACTIVE_CONTEXT.md` — current focus, practice servers, parked work, do-not-merge
4. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-10-31-session.md` — what the October 31 click-through shipped
5. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/conversations/2026-10-31-session-summary.md` — user-readable summary of that session
6. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-10-31-handoff-to-part-3.md` — the note that starts the next session. Follow this one, not the older "build the allowed-sender screen" lines.
7. `docs/plans/security-remediation-plan.md` — Part 1 complete. Parts 2 and 3 are built and not released. Do not rebuild fixes 5–7 unless the user asks.
8. `docs/task-2-multitenant-domain-plan.md` — Now vs Later. Stage B click-through passed. Part 3 is built on this practice branch and not released.
9. `docs/plans/canvases/repair-plan.canvas.tsx` — repair plan source. Live canvas: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136
10. `docs/procedures/RELEASE_CHECKLIST.md` — release wording. Do not run a release from this prompt.
11. `docs/system_architecture.md`, `docs/data_model.md`, `docs/incident-lifecycle.md`, and `docs/integrations.md` when touching architecture, data, incidents, reports, export, CAD, NERIS, or NEMSIS

**Sessions vs conversations (this branch):**

| Folder | Audience | Content | Count per working session |
|--------|----------|---------|---------------------------|
| **`sessions/`** | Next agent | What shipped, paths, commands, verification, next steps | **One** session note — do **not** add a new file for every sub-task in the same session |
| **`conversations/`** | User | Condensed summary of the **full** conversation (decisions, outcomes, what to test) | **One** file: **`YYYY-MM-DD-session-summary.md`** |

Older session files under `sessions/` (October 29 and October 30, and the earlier October 31 notes) stay as history. Part 3 is already built. Read `sessions/2026-10-31-security-part-3.md` before writing more security code.

**Hard stops until the user says otherwise:**
- Do not merge pull request 31.
- Do not touch staging, production, Neon, Render, or Cloudflare.
- Security Part 3 (fixes 5, 6, and 7) is built and not released. Do not rebuild it. Do not start Step 15 or the Fire Recovery email. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` on Render.
- Do not build the allowed-sender screen. That screen is Stage D, repair-plan step 23. Crescent's address is `dispatch@co.iroquois.il.us`.
- Do not build Recover Reports.
- Do not change the incident Status dropdown (Draft must not be removed until they ask; it is parked as unit status).
- Do not fix Incidents → Configure Table drag-and-drop.
- Do not change Submenu Display Settings so that unchecking hides the left menu.
- Do not upgrade Prisma. Stay on 7.10.1.
- Do not put auth secrets in `DepartmentDetails.payloadJson`.
- Keep the admin and demo accounts. `NODE_ENV=production` and `TRUST_PROXY=1` are release-time only.
- Fire Recovery tests use sandbox ID `FD12345678` only.
- The user cannot paste into the terminal. Practice screens are `http://localhost:5173` in the remote desktop browser. Do not send them to port 8787 for the app.

---

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: cursor/stage-b-foundation-b5ff unless I explicitly tell you to switch.
2) Use branch slug: cursor--stage-b-foundation-b5ff in paths under agent-handoffs/branches/cursor--stage-b-foundation-b5ff/
3) Read continuity docs:
   - cursoragent-context.md
   - .cursor/project-context.md
   - agent-handoffs/branches/cursor--stage-b-foundation-b5ff/ACTIVE_CONTEXT.md
   - agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-10-31-handoff-to-part-3.md
   - agent-handoffs/branches/cursor--stage-b-foundation-b5ff/conversations/2026-10-31-session-summary.md
4) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/plans/canvases/repair-plan.canvas.tsx
   - docs/system_architecture.md, docs/data_model.md, docs/incident-lifecycle.md, and docs/integrations.md when the task touches them
5) Before coding, summarize:
   - current branch and latest commit
   - Stage B click-through is done and not released
   - do not merge until Session, RolePermission, AccountAuditLog, and NerisReportChange exist on staging with a fresh backup
   - parked: Recover Reports, incident Status (unit status, drop Draft later), Configure Table drag, left-menu hiding
   - security Part 3 (fixes 5, 6, and 7) is built and not released. The allowed-sender screen is Stage D, not the next coding task unless I ask.
   - Now vs Later
6) Follow beginner-friendly communication: numbered where / click / type / expect. 24-hour time. I cannot paste into the terminal.
7) Practice site: http://localhost:5173 (Vite). Sign in demo / demo unless I changed it. Do not restart the practice proxy unless it is down or I am locked out.
8) After meaningful changes:
   - update this session's single note in agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/
   - keep ACTIVE_CONTEXT.md current
   - update the repair plan canvas source and republish canvas id 3b7445ce-b395-4e16-b948-f84dab1ca136
9) Before stopping:
   - update ACTIVE_CONTEXT.md
   - finalize this session's sessions note
   - add or refresh one conversations/YYYY-MM-DD-session-summary.md
   - commit and push on cursor/stage-b-foundation-b5ff
   - report branch, commit hash, changed files, and the next-step checklist
   - end with which agent/model answered

After acknowledging the rules above:
1) Security Part 3 is already built on this practice branch. Read docs/plans/security-remediation-plan.md Part 3 and sessions/2026-10-31-security-part-3.md. Do not rebuild fixes 5, 6, or 7 unless I ask.
2) Fix 5: the server writes the NERIS export record after NERIS replies. The browser may record only failures. No schema change.
3) Fix 6: Tenant.fireRecoveryApiPassword is encrypted with AES-256-GCM, tag enc:v1:, key from FIRE_RECOVERY_CREDENTIAL_KEY. Do not create that Render setting. Do not save a Fire Recovery password in production.
4) Fix 7: billing.view exists and defaults to admin. Billing information is hidden from users who do not have it.
5) Do not build the allowed-sender screen, Recover Reports, or the parked UI fixes. Do not merge. Do not touch staging, production, Neon, Render, or Cloudflare. Wait for my next request.

When I say "this session is coming to an end":
1) Update the one session file for this working session and ACTIVE_CONTEXT.md
2) Add or refresh one conversations/YYYY-MM-DD-session-summary.md
3) Republish the repair plan canvas if the plan changed
4) Commit and push on cursor/stage-b-foundation-b5ff and report branch, commit hash, and Now vs Later
```
