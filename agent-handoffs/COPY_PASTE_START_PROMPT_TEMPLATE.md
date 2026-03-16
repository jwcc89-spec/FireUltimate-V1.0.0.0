# Copy/Paste Start Prompt (submenu--departmentdetails-ui)

The agent will state at the end of each response **which agent/model was used** for that response (or that it cannot see your Cursor selection so you can check the UI). You do not need to record this yourself each session.

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: submenu--neris-golive-cifpd unless I explicitly tell you to switch.
2) Use branch slug: submenu--neris-golive-cifpd
3) Read continuity docs:
   - cursoragent-context.md
   - .cursor/project-context.md (project-level constraints)
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest relevant note(s) in agent-handoffs/branches/<branch-slug>/sessions/
   - all conversations in agent-handoffs/branches/<branch-slug>/conversations/
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
   - update session note
   - keep agent-handoffs/branches/submenu--neris-golive-cifpd/ACTIVE_CONTEXT.md current
8) Before stopping:
   - update agent-handoffs/branches/submenu--neris-golive-cifpd/ACTIVE_CONTEXT.md
   - finalize session note
   - commit + push on submenu/neris-golive-cifpd
   - report branch, commit hash, changed files, and next-step checklist

After acknowledging the rules above:
1) Continue from the current blcoker only (do no restart solved work).
2) Sync latest Code for submenu/neris-golive-cifpd
3) Validate changes (build/test/lint as appropriate), then report clearly.
4) If blocked by external dependency (vendor/API/permissions), state it explicitly and provide exact next action.
5) Before ending:
   - update session note + branch ACTIVE_CONTEXT.md
   - create a copy of entire full-conversation in agent-handoffs/branches/<branch-slug>/conversations
   - commit + push on submenu/neris-golive-cifpd
   - report branch, commit hash, changed files, and next-step checklist
   - include **Now vs Later** callouts in the final report and handoff note

When the user says "this session is coming to and end":
Before ending: 
1) update session note + branch ACTIVE_CONTEXT.md
2) create a copy of entire full-conversation in agent-handoffs/branches/<branch-slug>/conversations
3) Review all docs and suggest any updates based on completed work this session; move docs to /completed if needed.
After user acknowledges then:
1) Commit + push; report branch, commit hash, changed files, next-step checklist; include **Now vs Later** callouts.
```
