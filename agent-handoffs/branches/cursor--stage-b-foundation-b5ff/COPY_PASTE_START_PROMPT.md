# Copy/Paste Start Prompt (cursor/stage-b-foundation-b5ff)

When a new agent starts and the user says **"read the COPY_PASTE_START_PROMPT for this branch"**, read this file first, then the docs below.

The agent states at the end of each response **which agent/model was used**. The user does not record that.

**Branch:** `cursor/stage-b-foundation-b5ff`  
**Slug:** `cursor--stage-b-foundation-b5ff`  
**Pull request 31:** https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31 — **merged** into `submenu/neris-golive-cifpd` at `d4bbaee` on 2026-11-01, about 1:33 p.m. America/Chicago. Do not merge it again. Do not merge to `main`.

**Where the program is (2026-11-01, America/Chicago):**
- Staging (`https://cifpdil.staging.fireultimate.app`, Render `fireultimate-api-staging`) runs `d4bbaee`. The Crescent click test passed about 2:09 p.m. No step failed.
- This practice branch is ahead of staging by documentation commits only. Do not push those onto `submenu/neris-golive-cifpd`. That push redeploys staging.
- Production (`main`) does not have Stage B. It has the Fix 15 one-line hotfix only. A production release needs a fresh backup of `fireultimate-prod`, the three new migrations, Crescent's sender saved **before** the new program starts, the same Render build command, and a separate approval. Do not start that pass unless the user asks.

**Relevant docs to read (in order):**
1. `cursoragent-context.md` — session handoff workflow and branch rules
2. `.cursor/project-context.md` — project constraints and 24-hour time
3. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/ACTIVE_CONTEXT.md` — current focus. Trust this file over older session notes.
4. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-11-01-staging-promote.md` — what this session shipped
5. `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/conversations/2026-11-01-session-summary.md` — user-readable summary
6. `docs/plans/security-remediation-plan.md` — trust the **Status** line. Staging click test passed. Production is not updated.
7. `docs/task-2-multitenant-domain-plan.md` — Now vs Later
8. `docs/plans/canvases/repair-plan.canvas.tsx` — repair plan source. Live canvas was not republished on 2026-11-01: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136
9. `docs/procedures/RELEASE_CHECKLIST.md` — release wording. Do not run a production release from this prompt.
10. `docs/system_architecture.md`, `docs/data_model.md`, `docs/incident-lifecycle.md`, and `docs/integrations.md` when touching architecture, data, incidents, reports, export, CAD, NERIS, or NEMSIS

October 31 session files stay as history. They still say "not released." That was true that day. It is not the current status.

**Sessions vs conversations (this branch):**

| Folder | Audience | Content | Count per working session |
|--------|----------|---------|---------------------------|
| **`sessions/`** | Next agent | What shipped, paths, commands, verification, next steps | **One** session note — do **not** add a new file for every sub-task in the same session |
| **`conversations/`** | User | Condensed summary of the **full** conversation (decisions, outcomes, what to test) | **One** file: **`YYYY-MM-DD-session-summary.md`** |

**Hard stops until the user says otherwise:**
- Do not merge to `main`. Do not fast-forward `submenu/neris-golive-cifpd`.
- Do not touch production, `fireultimate-prod`, or `fireultimate-api-prod`.
- Do not rebuild Stage B, security fixes 1–14, Part 0, or the Allowed Senders screen. They are on staging.
- Wave 2 (the Fire Recovery Billing tab) is built on this practice branch. Do not start Wave 3 until the user reviews Wave 2. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` or `FIRE_RECOVERY_MODE` on Render. Do not save a Fire Recovery password in production. Do not build Recover Reports.
- Do not build the parked items: incident Status (drop Draft), Configure Table drag, left-menu hiding, canceled-en-route time fill, or per-user Edit My Display.
- Do not upgrade Prisma. Stay on 7.10.1. Do not change `.npmrc` `engine-strict=true`. Do not raise Render to Node 22.
- Staging build command that works on Node 20.19: `npm ci --engine-strict=false && npm run build`. Do not add a dashboard `NODE_ENV` variable. Render already sets `NODE_ENV=production` for the running server only.
- Do not put auth secrets in `DepartmentDetails.payloadJson`.
- Keep the demo tenant persistent. Do not run seed or `migrate reset`.
- Tests use only `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable`. Never Neon.
- This Mac’s `.env.server` points the local API at the staging Neon database. Username `demo` uses the staging password. That password is not the word `demo`. Do not run `npm run db:seed`. Do not ask the user to paste the password.
- Do not delete Crescent's staging sender `dispatch@co.iroquois.il.us` (id `allow-cifpdil-dispatch-20261101`). CAD mailbox is `cifpdil@cad.fireultimate.app`.
- Leave Neon branch `backup-2026-11-01-before-stage-b` alone.
- The user cannot paste into the terminal. Practice screens are `http://localhost:5173` in the remote desktop browser. Do not send them to port 8787 for the app.
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
   - agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-11-01-staging-promote.md
   - agent-handoffs/branches/cursor--stage-b-foundation-b5ff/conversations/2026-11-01-session-summary.md
4) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/plans/security-remediation-plan.md (trust the Status line)
   - docs/plans/canvases/repair-plan.canvas.tsx
   - docs/system_architecture.md, docs/data_model.md, docs/incident-lifecycle.md, and docs/integrations.md when the task touches them
5) Before coding, summarize:
   - current branch and latest commit
   - Stage B is on staging. The Crescent click test passed on 2026-11-01. Production is not updated.
   - pull request 31 is already merged. Do not merge to main.
   - parked: Recover Reports, incident Status (unit status, drop Draft later), Configure Table drag, left-menu hiding, canceled-en-route time fill, per-user Edit My Display
   - Now vs Later
6) Follow beginner-friendly communication: numbered where / click / type / expect. 24-hour time. I cannot paste into the terminal.
7) Practice site: http://localhost:5173 (Vite). On this Mac the API uses the staging database. Sign in as demo with the staging password. Do not restart the practice proxy unless it is down or I am locked out.
8) After meaningful changes:
   - update this session's single note in agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/
   - keep ACTIVE_CONTEXT.md current
   - update the repair plan canvas source. Republish canvas id 3b7445ce-b395-4e16-b948-f84dab1ca136 only if I ask.
9) Before stopping:
   - update ACTIVE_CONTEXT.md
   - finalize this session's sessions note
   - add or refresh one conversations/YYYY-MM-DD-session-summary.md
   - commit and push on cursor/stage-b-foundation-b5ff only
   - report branch, commit hash, changed files, and the next-step checklist
   - end with which agent/model answered

After acknowledging the rules above:
1) Wait for my next request. Do not start the production release.
2) Do not rebuild Stage B, fixes 1–14, Part 0, or the Allowed Senders screen.
3) Do not create FIRE_RECOVERY_CREDENTIAL_KEY. Do not save a Fire Recovery password in production.
4) Do not build the parked items. Do not push this practice branch onto submenu/neris-golive-cifpd.

When I say "this session is coming to an end":
1) Update the one session file for this working session and ACTIVE_CONTEXT.md
2) Add or refresh one conversations/YYYY-MM-DD-session-summary.md
3) Update the repair plan canvas source. Republish only if I ask.
4) Commit and push on cursor/stage-b-foundation-b5ff and report branch, commit hash, and Now vs Later
```
