# Copy/Paste Start Prompt (submenu--neris-golive-cifpd)

When a new agent starts and the user says **"read the COPY_PASTE_START_PROMPT for this branch"**, read this file first, then read the docs and branch rules below so you are fully up to speed.

The agent will state at the end of each response **which agent/model was used** for that response (or that it cannot see your Cursor selection so you can check the UI). You do not need to record this yourself each session.

**Relevant docs to read (in order):**
1. `.cursor/project-context.md` (or `cursoragent-context.md` if present) — project constraints and time-format convention
2. `cursoragent-context.md` — session handoff workflow and branch rules
3. `agent-handoffs/branches/submenu--neris-golive-cifpd/ACTIVE_CONTEXT.md` — current focus, blocker, last session, next steps
4. `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md` — consolidated priority list and suggested order
5. `docs/procedures/BACKLOG_INCIDENTS_NERIS_UX.md` — master list for incidents/NERIS UX (backlog #2–#11)
6. `docs/agent-execution-contract.md` — preflight, delivery, verification, handoff rules
7. `docs/task-2-multitenant-domain-plan.md` — multi-tenant and Now vs Later
8. `docs/later-changes-backlog.md` — deferred platform/UI work
9. `docs/procedures/README.md` — index of procedures
10. `docs/procedures/EMAIL_AND_CAD_SETUP.md` — when working on email or CAD ingest
11. `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md` — when working on NERIS cross-browser
12. `docs/procedures/GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md` — go-live sequence and endpoint checks
13. `docs/plans/ROLE_HIERARCHY_PHASE1_IMPLEMENTATION_GUIDE.md` — when touching roles/admin/superadmin (number-based hierarchy)
14. Latest note in `agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/`
15. Recent files in `agent-handoffs/branches/submenu--neris-golive-cifpd/conversations/`

**When touching architecture, data, incidents/export, or CAD/NERIS/NEMSIS, also read:**
- `docs/system_architecture.md`, `docs/data_model.md`, `docs/incident-lifecycle.md`, `docs/integrations.md`

---

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: submenu/neris-golive-cifpd unless I explicitly tell you to switch. Use branch slug: submenu--neris-golive-cifpd in paths.
2) Read continuity docs (see numbered list above): project-context, cursoragent-context, ACTIVE_CONTEXT, PRIORITY, BACKLOG_INCIDENTS_NERIS_UX, execution contract, task-2 plan, later-changes-backlog; procedures README; EMAIL_AND_CAD_SETUP (if email/CAD); NERIS_CROSS_BROWSER_FINDINGS (if NERIS cross-browser); GO_LIVE_CHECKPOINT (go-live); ROLE_HIERARCHY (if roles/admin); latest sessions/ and conversations/.
3) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/later-changes-backlog.md
   - When touching architecture/data/incidents/export or CAD/NERIS/NEMSIS: docs/system_architecture.md, docs/data_model.md, docs/incident-lifecycle.md, docs/integrations.md
4) Before coding, summarize:
   - current branch
   - identify latest commits
   - what previous agent completed
   - current blocker/status
   - exact next implementation step
   - summarize what changed and what is still pending
   - include explicit **Now vs Later** callouts (what is in scope now vs deferred follow-up)
   - include explicit **Risks vs Rewards** and better/alternative implementation path when applicable
5) If preflight identifies meaningful risk, get explicit user confirmation before making edits.
6) Follow beginner-friendly communication and explain commands clearly.
7) After meaningful changes: update session note; keep ACTIVE_CONTEXT.md current.
8) Before stopping: update ACTIVE_CONTEXT.md; finalize session note; commit + push on submenu/neris-golive-cifpd; report branch, commit hash, changed files, and next-step checklist.

After acknowledging the rules above:
1) Continue from the current blocker only (do not restart solved work).
2) Sync latest code for submenu/neris-golive-cifpd (e.g. git pull).
3) Validate changes (build/test/lint as appropriate), then report clearly.
4) If blocked by external dependency (vendor/API/permissions), state it explicitly and provide exact next action.

When the user says "this session is coming to an end":
Before ending: 
1) Update session note + ACTIVE_CONTEXT.md
2) Add conversation summary to conversations/ 
3) Review all docs and suggest any updates based on completed work this session; move docs to /completed if needed.
After user acknowledges then:
1) Commit + push; report branch, commit hash, changed files, next-step checklist; include **Now vs Later** callouts.
```
