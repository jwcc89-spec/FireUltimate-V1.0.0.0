# Quick Prompts for New/Updated Agents

Use these copy/paste prompts to keep branch work and handoff notes isolated.

---

## 1) Start or resume work on a branch (recommended)

```md
Handoff + work request.

1) Confirm and stay on branch: <branch-name>
2) Compute branch slug by replacing "/" with "--"
   - Example: submenu/neris-ui -> submenu--neris-ui
3) Read:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest file in agent-handoffs/branches/<branch-slug>/sessions/
4) Before edits, summarize:
   - current branch + latest commit
   - current blocker/status
   - exact next implementation step
5) Implement requested changes only on <branch-name>
6) Update handoff docs for this branch only:
   - add a new session note in agent-handoffs/branches/<branch-slug>/sessions/
   - refresh agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
7) Commit + push on <branch-name>
8) Report back with:
   - commit hash
   - files changed
   - one-paragraph summary
```

---

## 2) Handoff sync only (no feature work)

```md
Handoff sync request only (no feature work).

1) Stay on branch: <branch-name>
2) Compute branch slug: <branch-slug>
3) Read:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest file in agent-handoffs/branches/<branch-slug>/sessions/
4) Create a new session note in:
   - agent-handoffs/branches/<branch-slug>/sessions/
   using:
   - agent-handoffs/HANDOFF_TEMPLATE.md
5) In that note summarize:
   - current branch + latest commit
   - current blocker/status
   - what should happen next
6) Update:
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
7) Commit + push on <branch-name>
8) Report:
   - commit hash
   - files updated
   - one-paragraph summary
```

---

## 3) Bugfix-only pass on current branch

```md
Bugfix-only pass.

1) Stay on branch: <branch-name>
2) Read branch context:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
3) Fix only the reported issue(s), no unrelated refactors.
4) Run build/tests relevant to the change.
5) Update branch handoff notes (new session note + ACTIVE_CONTEXT).
6) Commit + push on <branch-name>.
7) Return:
   - root cause
   - fix summary
   - verification steps and results
```

---

## Notes

- Branch notes are intentionally isolated to reduce cross-branch confusion.
- Do not update another branch's handoff folder unless explicitly requested.
