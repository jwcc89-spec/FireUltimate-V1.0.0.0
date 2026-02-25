# Copy/Paste Start Prompt (<branch-slug>)

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: <branch-slug> unless I explicitly tell you to switch.
2) Use branch slug: <branch-slug>
3) Read continuity docs:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest relevant note(s) in agent-handoffs/branches/<branch-slug>/sessions/
   - all conversations in agent-handoffs/branches/<branch-slug>/conversations/
4) Before coding, summarize:
   - current branch
   - identify latest commits
   - what previous agent completed
   - current blocker/status
   - exact next implementation step
   - summarize what changed and what is still pending
5) Follow beginner-friendly communication and explain commands clearly.
6) After meaningful changes:
   - update session note
   - keep agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md current
7) Before stopping:
   - update agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - finalize session note
   - commit + push on <branch-slug>
   - report branch, commit hash, changed files, and next-step checklist

After acknowledging the rules above:

1) Continue from the current blcoker only (do no restart solved work).
2) sync latest code for <branch-slug> (fetch/pull)
2) Validate changes (build/test/lint as appropriate), then report clearly.
3) If blocked by external dependency (vendor/API/permissions), state it explicitly and provide exact next action.
4) Before ending:
   - update session note + branch ACTIVE_CONTEXT.md
   - commit + push on <branch-slug>
   - report branch, commit hash, changed files, and next-step checklist


```
