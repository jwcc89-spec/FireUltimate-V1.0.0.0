# Quick Prompt Library

Use these copy/paste prompts to keep agent context consistent.

---

## 1) Prompt for another active cloud agent (handoff-only sync)

```text
Handoff sync request only (no feature work yet).

1) Stay on branch: neris/phase-1
2) Read:
   - cursoragent-context.md
   - agent-handoffs/ACTIVE_CONTEXT.md
   - latest files in agent-handoffs/sessions/
3) Create a new session note in agent-handoffs/sessions/ using the template:
   - agent-handoffs/HANDOFF_TEMPLATE.md
4) In that note, summarize:
   - current branch + latest commit
   - current blocker/status
   - what should happen next
5) Update agent-handoffs/ACTIVE_CONTEXT.md to reflect latest truth.
6) Commit + push these handoff updates to neris/phase-1.
7) Report back with:
   - commit hash
   - files updated
   - one-paragraph summary
```

---

## 2) Prompt for any new agent at session start (bootstrap prompt)

```text
Before any work, do this in order:

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Stay on that branch unless I explicitly tell you to switch.
2) Propose a chat title in this format:
   <branch> | <task-focus>
3) Read these files first:
   - cursoragent-context.md
   - agent-handoffs/ACTIVE_CONTEXT.md
   - latest relevant note(s) in agent-handoffs/sessions/
4) Create a new session note using:
   - agent-handoffs/HANDOFF_TEMPLATE.md
   - filename format: YYYY-MM-DD-HHMMZ-<agent-type>-<topic>.md
5) Follow beginner-friendly communication:
   - explain each command in plain language
   - provide step-by-step test instructions
   - report expected vs actual output
6) After each meaningful change:
   - update your session note (what changed, why, result, commit)
   - keep ACTIVE_CONTEXT.md current enough for agent switching
7) Before stopping (or if I go idle):
   - update ACTIVE_CONTEXT.md with latest branch/commit/blockers/next steps
   - commit + push handoff updates
```

---

## 3) Prompt for cloud agent continuing after Cursor desktop changes

```text
Continuation mode:

1) Mandatory first question:
   "Which branch am I working on?"
2) Stay on that branch.
3) Sync latest code:
   - fetch/pull the branch
4) Read continuity docs:
   - cursoragent-context.md
   - agent-handoffs/ACTIVE_CONTEXT.md
   - newest notes in agent-handoffs/sessions/
5) Detect new work from other agents (including Cursor desktop):
   - identify latest commits since last handoff
   - summarize what changed and what is still pending
6) Continue implementation from current blocker only (don’t restart solved work).
7) Validate changes (lint/build/tests as appropriate), then report clearly.
8) If blocked by external dependency (vendor/API permissions), state that explicitly and provide exact next action.
9) Before ending:
   - update session note + ACTIVE_CONTEXT.md
   - commit + push
   - report branch + commit hash + next-step checklist
```
