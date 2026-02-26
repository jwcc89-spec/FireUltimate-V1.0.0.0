# Quick Prompt Library (Branch-Scoped)

Use these prompts as copy/paste starters for new and continuing agents.

---

## 1) New Agent & New Branch bootstrap prompt (primary copy/paste)

```text
Before any feature work, do this in order.

MANDATORY FIRST QUESTION:
"Which branch am I working on?"

After I answer:
1) Compute branch slug by replacing "/" with "--".
   - Example: submenu/neris-ui -> submenu--neris-ui
2) Name Chat <branch-slug>
3) Stay on that branch unless I explicitly tell you to switch.
4) Compute branch slug by replacing "/" with "--".
   - Example: submenu/neris-ui -> submenu--neris-ui
5) If branch handoff folder does not exist, create it:
   - agent-handoffs/branches/<branch-slug>/
   - agent-handoffs/branches/<branch-slug>/sessions/
   - agent-handoffs/branches/<branch-slug>/conversations/
   - create ACTIVE_CONTEXT.md from agent-handoffs/ACTIVE_CONTEXT_TEMPLATE.md
   - create first session note from agent-handoffs/HANDOFF_TEMPLATE.md
   - create COPY_PASTE_START_PROMPT.md from COPY_PASTE_START_PROMPT_TEMPLATE.md
6) Read these files first:
   - cursoragent-context.md
   - agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
   - latest relevant note(s) in agent-handoffs/branches/<branch-slug>/sessions/
   - all conversations in agent-handoffs/branches/<branch-slug>/conversations/
7) Before coding, summarize:
   - current branch + latest commit
   - what previous agent completed
   - current blocker/status
   - exact next implementation step
8) Follow beginner-friendly communication:
   - explain each command in plain language
   - provide step-by-step test instructions
   - report expected vs actual output
9) After meaningful changes:
   - update this session note
   - keep branch ACTIVE_CONTEXT.md current
10) Before stopping:
   - update branch ACTIVE_CONTEXT.md with latest truth
   - add/finalize a session note
   - commit + push
   - report branch, commit hash, changed files, and next-step checklist
```

---

## 2) Close Agent/Conversation (Send to Agent to ensure they update relevant information)

```text
This conversation is coming to an end for our current session. Follow the steps below to ensure we preserve the branch. update active_context.md and session notes.

MANDATORY FIRST RESPONSE:
-confirm current branch

After I answer:
1) Update agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md
2) finalize session note
3) Create or update a copy of all conversation history as a backup in agent-handoffs/branches/<branch-slug>/conversations/<timestamp>-<agent>-conversation.md

MANDATORY FINAL RESPONSE:
- confirm that agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md has been updated
- confirm that session note has been finalized
- confirm that convsation history has been updated in its entirety in agent-handoffs/branches/<branch-slug>/conversations/ 
- commit + push on <branch-slug>

```

---

## Notes

- Branch notes are intentionally isolated to reduce cross-branch confusion.
- Do not update another branch's handoff folder unless explicitly requested.
- If you prefer hardcoded prompts per branch, duplicate prompt #2/#3 into:
  - `agent-handoffs/branches/<branch-slug>/QUICK_PROMPTS.md`
