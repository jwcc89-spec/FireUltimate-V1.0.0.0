# Quick Prompt Library (Branch-Scoped)

Use these prompts as copy/paste starters for new and continuing agents.

---

## 1) Handoff sync (existing branch, no feature work yet)

```text
Handoff sync request only (no feature work yet).

1) Stay on branch: <your-branch>
2) Read:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest files in agent-handoffs/branches/<branch-slug>/sessions/
3) Create a new session note in agent-handoffs/branches/<branch-slug>/sessions/ using:
   - agent-handoffs/HANDOFF_TEMPLATE.md
4) In that note summarize:
   - current branch + latest commit
   - current blocker/status
   - what should happen next
5) Update agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md.
6) Commit + push.
7) Report:
   - commit hash
   - files updated
   - one-paragraph summary
```

---

## 2) New agent bootstrap prompt (primary copy/paste)

```text
Before any feature work, do this in order.

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Name Chat <branch-slug>
2) Stay on that branch unless I explicitly tell you to switch.
3) Compute branch slug by replacing "/" with "--".
   - Example: submenu/neris-ui -> submenu--neris-ui
4) If branch handoff folder does not exist, create it:
   - agent-handoffs/branches/<branch-slug>/
   - agent-handoffs/branches/<branch-slug>/sessions/
   - create ACTIVE_CONTEXT.md from agent-handoffs/ACTIVE_CONTEXT_TEMPLATE.md
   - create first session note from agent-handoffs/HANDOFF_TEMPLATE.md
5) Read these files first:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest relevant note(s) in agent-handoffs/branches/<branch-slug>/sessions/
6) Before coding, summarize:
   - current branch + latest commit
   - what previous agent completed
   - current blocker/status
   - exact next implementation step
7) Follow beginner-friendly communication:
   - explain each command in plain language
   - provide step-by-step test instructions
   - report expected vs actual output
8) After meaningful changes:
   - update this session note
   - keep branch ACTIVE_CONTEXT.md current
9) Before stopping:
   - update branch ACTIVE_CONTEXT.md with latest truth
   - add/finalize a session note
   - commit + push
   - report branch, commit hash, changed files, and next-step checklist
```

---

## 3) Cloud continuation prompt after Cursor work (primary copy/paste)

```text
Continuation mode (Cloud agent picking up where Cursor agent left off):

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Stay on that branch.
2) Compute branch slug by replacing "/" with "--".
3) Sync latest code for that branch (fetch/pull).
4) Read continuity docs:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - newest notes in agent-handoffs/branches/<branch-slug>/sessions/
5) Detect new work since last handoff:
   - identify latest commits
   - summarize what changed and what is still pending
6) Continue from current blocker only (do not restart solved work).
7) Validate changes (build/test/lint as appropriate), then report clearly.
8) If blocked by external dependency (vendor/API/permissions), state it explicitly and provide exact next action.
9) Before ending:
   - update session note + branch ACTIVE_CONTEXT.md
   - commit + push
   - report branch + commit hash + next-step checklist
```

---

## 4) New branch bootstrap prompt (first agent on brand-new branch)

```text
New branch handoff bootstrap (run once per new branch).

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Stay on that branch.
2) Compute branch slug by replacing "/" with "--".
3) Create branch handoff paths:
   - agent-handoffs/branches/<branch-slug>/
   - agent-handoffs/branches/<branch-slug>/sessions/
4) Create:
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md (from agent-handoffs/ACTIVE_CONTEXT_TEMPLATE.md)
   - agent-handoffs/branches/<branch-slug>/sessions/<timestamp>-<agent>-bootstrap.md (from agent-handoffs/HANDOFF_TEMPLATE.md)
5) Populate ACTIVE_CONTEXT.md with:
   - branch name
   - latest commit
   - current focus
   - blocker/status
   - exact next steps
6) Commit + push these branch handoff files.
7) Then continue normal implementation flow.
```

---

## Notes

- Branch notes are intentionally isolated to reduce cross-branch confusion.
- Do not update another branch's handoff folder unless explicitly requested.
- If you prefer hardcoded prompts per branch, duplicate prompt #2/#3 into:
  - `agent-handoffs/branches/<branch-slug>/QUICK_PROMPTS.md`
