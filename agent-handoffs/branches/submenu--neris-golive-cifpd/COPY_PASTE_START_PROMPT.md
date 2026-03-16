# Copy/Paste Start Prompt (submenu--neris-golive-cifpd)

The agent will state at the end of each response **which agent/model was used** for that response (or that it cannot see your Cursor selection so you can check the UI). You do not need to record this yourself each session.

**Relevant docs to read (paste these for a new agent when starting remotely):**
- `.cursor/project-context.md` (or `cursoragent-context.md` if present)
- `agent-handoffs/branches/submenu--neris-golive-cifpd/ACTIVE_CONTEXT.md`
- `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md`
- `docs/procedures/EMAIL_AND_CAD_SETUP.md`
- `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md`
- `docs/agent-execution-contract.md`
- `docs/task-2-multitenant-domain-plan.md`
- `docs/later-changes-backlog.md`
- `docs/procedures/README.md` (index of procedures)
- Latest note in `agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/`
- Any files in `agent-handoffs/branches/submenu--neris-golive-cifpd/conversations/`

---

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: submenu/neris-golive-cifpd unless I explicitly tell you to switch. Use branch slug: submenu--neris-golive-cifpd in paths.
2) Read continuity docs:
   - .cursor/project-context.md (or cursoragent-context.md)
   - agent-handoffs/branches/submenu--neris-golive-cifpd/ACTIVE_CONTEXT.md
   - docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md
   - docs/procedures/EMAIL_AND_CAD_SETUP.md (if working on email or CAD ingest)
   - docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md (if working on NERIS cross-browser)
   - latest note(s) in agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/
   - all conversations in agent-handoffs/branches/submenu--neris-golive-cifpd/conversations/
3) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/later-changes-backlog.md
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

When the user says "this session is coming to and end":
Before ending: 
1) Update session note + ACTIVE_CONTEXT.md
2) Add conversation summary to conversations/ 
3) Review all docs and suggest any updates based on completed work this session; move docs to /completed if needed.
After user acknowledges then:
1) Commit + push; report branch, commit hash, changed files, next-step checklist; include **Now vs Later** callouts.
```
