# Cursor Agent Context Rules

## 1) Session start behavior
1. Start by confirming the working branch if not already explicitly provided.
2. If the user already provided a branch for this chat, stay on that branch unless told to switch.
3. Report branch name in completion notes for every task.

## 2) Branch-specific handoff policy
4. All handoff notes must be branch-scoped.
5. Branch handoff root path format:
   - `agent-handoffs/branches/<branch-slug>/`
6. Branch slug rule:
   - replace `/` with `--`
   - Example: `submenu/neris-ui` -> `submenu--neris-ui`
7. Each branch folder should contain:
   - `ACTIVE_CONTEXT.md`
   - `sessions/` (timestamped notes)
8. Agents should not update another branch's handoff folder unless explicitly asked.

## 3) Communication style
9. Assume beginner-friendly explanations by default.
10. Explain what commands do, why they are needed, and what success/failure looks like.
11. Provide clear next test steps after changes.

## 4) Git discipline
12. Do not silently switch branches.
13. If work lands on the wrong branch, cherry-pick to the intended branch and report it clearly.
14. Commit and push in small logical units.

## 5) Session handoff workflow
15. At session start, read:
   - this file
   - `agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md`
   - latest note in `agent-handoffs/branches/<branch-slug>/sessions/`
16. Before ending session:
   - update branch `ACTIVE_CONTEXT.md`
   - add a new timestamped session note in that same branch folder
