# Copy/Paste Start Prompt (template)

The agent will state at the end of each response **which agent/model was used** for that response (or that it cannot see your Cursor selection so you can check the UI). You do not need to record this yourself each session.

**Placeholders when copying into a branch folder:**  
`<branch-name>` = git branch (e.g. `menu-submenu/ui-updates`). `<branch-slug>` = folder slug (e.g. `menu-submenu--ui-updates`).

---

## Sessions vs conversations (branch handoff)

| Folder | Audience | Content | Count per working session |
|--------|----------|---------|---------------------------|
| **`agent-handoffs/branches/<branch-slug>/sessions/`** | Next agent | What shipped, paths, commands, verification, next steps | **One** session note — do **not** add a new file for every sub-task in the same session |
| **`agent-handoffs/branches/<branch-slug>/conversations/`** | User | Condensed summary of the **full** conversation (decisions, outcomes, what to test) | **One** file per session: **`YYYY-MM-DD-session-summary.md`** — not multiple micro-summaries for the same session |

**Typical filenames:**

- Session (agent): **`sessions/YYYY-MM-DD-session.md`** (or `sessions/YYYY-MM-DD-<short-topic>-session.md` if you need a themed name — still **one file per working session**).
- Conversation (user): **`conversations/YYYY-MM-DD-session-summary.md`**.

**Read order for continuity:** latest **`sessions/YYYY-MM-DD-session.md`** (or the most recent file in `sessions/`), and latest **`conversations/YYYY-MM-DD-session-summary.md`** in `conversations/`.

---

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: <branch-name> unless I explicitly tell you to switch.
2) Use branch slug: <branch-slug> in paths under agent-handoffs/branches/<branch-slug>/
3) Read continuity docs:
   - cursoragent-context.md
   - .cursor/project-context.md (project-level constraints)
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - Latest session note: agent-handoffs/branches/<branch-slug>/sessions/ (prefer sessions/YYYY-MM-DD-session.md or the most recent session file)
   - Latest user summary: agent-handoffs/branches/<branch-slug>/conversations/YYYY-MM-DD-session-summary.md (condensed summation of that session)
4) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/system_architecture.md
   - docs/data_model.md
   - docs/incident-lifecycle.md (when touching incidents/reports/export)
   - docs/integrations.md (when touching CAD/NERIS/NEMSIS)
   - docs/later-changes-backlog.md
5) Before coding, summarize:
   - current branch
   - identify latest commits
   - what previous agent completed
   - current blocker/status
   - exact next implementation step
   - summarize what changed and what is still pending
   - include explicit **Now vs Later** callouts (what is in scope now vs deferred follow-up)
6) Follow beginner-friendly communication: step-by-step directions, clear **do this now** vs **do this later**, and explain commands clearly.
7) After meaningful changes:
   - update **this session’s** single note in agent-handoffs/branches/<branch-slug>/sessions/ (see Sessions vs conversations table above)
   - keep agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md current
8) Before stopping:
   - update agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - finalize **this session’s** sessions/YYYY-MM-DD-session.md (agent handoff)
   - when ending a session, add or refresh **one** conversations/YYYY-MM-DD-session-summary.md for the user
   - commit + push on <branch-name>
   - report branch, commit hash, changed files, and next-step checklist

After acknowledging the rules above:
1) Continue from the current blocker only (do not restart solved work).
2) Sync latest code for <branch-name>
3) Validate changes (build/test/lint as appropriate), then report clearly.
4) If blocked by external dependency (vendor/API/permissions), state it explicitly and provide exact next action.

When the user says "this session is coming to an end":
Before ending:
1) Update **one** session file in agent-handoffs/branches/<branch-slug>/sessions/ for this working session + ACTIVE_CONTEXT.md
2) Add or refresh **one** agent-handoffs/branches/<branch-slug>/conversations/YYYY-MM-DD-session-summary.md (condensed summation for the user)
3) Review all docs and suggest any updates based on completed work this session; move docs to /completed if needed.
4) Include **Now vs Later** callouts in the final report and handoff note and next-step checklist.
After user acknowledges then:
1) Commit + push on <branch-name>; report branch, commit hash, changed files, next-step checklist; include **Now vs Later** callouts.
```
