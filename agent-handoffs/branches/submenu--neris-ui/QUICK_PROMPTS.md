# Quick Prompts (Hardcoded: submenu/neris-ui)

These are immediate copy/paste prompts for agents working on this branch only.

---

## 1) New agent bootstrap (submenu/neris-ui)

```text
Before any feature work, do this in order.

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Stay on branch: submenu/neris-ui unless I explicitly tell you to switch.
2) Use branch slug: submenu--neris-ui
3) Read:
   - cursoragent-context.md
   - agent-handoffs/branches/submenu--neris-ui/ACTIVE_CONTEXT.md
   - latest relevant note(s) in agent-handoffs/branches/submenu--neris-ui/sessions/
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

---

## 2) Cloud continuation after Cursor work (submenu/neris-ui)

```text
Continuation mode (Cloud agent picking up where Cursor agent left off):

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Stay on branch: submenu/neris-ui.
2) Sync latest code for submenu/neris-ui.
3) Read:
   - cursoragent-context.md
   - agent-handoffs/branches/submenu--neris-ui/ACTIVE_CONTEXT.md
   - newest notes in agent-handoffs/branches/submenu--neris-ui/sessions/
4) Detect new work since last handoff:
   - identify latest commits
   - summarize what changed and what is still pending
5) Continue from current blocker only (do not restart solved work).
6) Validate changes (build/test/lint as appropriate), then report clearly.
7) If blocked by external dependency, state it explicitly and provide exact next action.
8) Before ending:
   - update session note + ACTIVE_CONTEXT.md
   - commit + push on submenu/neris-ui
   - report branch + commit hash + next-step checklist
```
