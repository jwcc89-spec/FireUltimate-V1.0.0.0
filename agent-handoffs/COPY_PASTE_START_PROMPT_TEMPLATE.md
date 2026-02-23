# Copy/Paste Start Prompt (<branch-slug>)

```text
Before any feature work, do this in order.

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Stay on branch: <branch-slug> unless I explicitly tell you to switch.
2) Use branch slug: <branch-slug>
3) Read:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest relevant note(s) in agent-handoffs/branches/<branch-slug>/sessions/
4) Before coding, summarize:
   - current branch + latest commit
   - what previous agent completed
   - current blocker/status
   - exact next implementation step
5) Follow beginner-friendly communication and explain commands clearly.
6) After meaningful changes:
   - update session note
   - keep ACTIVE_CONTEXT.md current
7) Before stopping:
   - update ACTIVE_CONTEXT.md
   - finalize session note
   - commit + push on submenu/neris-ui
   - report branch, commit hash, changed files, and next-step checklist
```
