# Branch-Scoped Agent Handoffs

This workspace uses branch-specific handoff notes so each agent only sees context for the branch they are actively working on.

## Folder layout

```
agent-handoffs/
  ACTIVE_CONTEXT_TEMPLATE.md
  HANDOFF_TEMPLATE.md
  QUICK_PROMPTS.md
  branches/
    <branch-slug>/
      ACTIVE_CONTEXT.md
      QUICK_PROMPTS.md (optional hardcoded branch prompts)
      sessions/
        YYYY-MM-DD-HHMMZ-<agent>-<topic>.md
```

## Branch slug convention

- Convert git branch name to folder slug by replacing `/` with `--`.
- Example:
  - Branch: `submenu/neris-ui`
  - Folder: `agent-handoffs/branches/submenu--neris-ui/`

## Session start checklist

1. Confirm branch.
2. Compute branch slug.
3. Read:
   - `cursoragent-context.md`
   - `agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md`
   - latest note under `agent-handoffs/branches/<branch-slug>/sessions/`
4. Optional: copy a starter prompt from `agent-handoffs/QUICK_PROMPTS.md`.

## Session end checklist

1. Add a new timestamped note under branch `sessions/`.
2. Refresh branch `ACTIVE_CONTEXT.md` with latest truth:
   - branch and latest commit
   - current blocker/status
   - exact next steps
3. Commit and push on the same branch.

## New branch setup (first agent only)

1. Confirm the branch name with the user.
2. Create the branch folder and sessions folder:
   - `agent-handoffs/branches/<branch-slug>/`
   - `agent-handoffs/branches/<branch-slug>/sessions/`
3. Create `ACTIVE_CONTEXT.md` from `agent-handoffs/ACTIVE_CONTEXT_TEMPLATE.md`.
4. Create first session note from `agent-handoffs/HANDOFF_TEMPLATE.md`.
5. Commit and push the handoff scaffold before feature work.

## Hardcoded-per-branch option (recommended for copy/paste speed)

- Keep global prompt library in `agent-handoffs/QUICK_PROMPTS.md`.
- For frequently used branches, also create:
  - `agent-handoffs/branches/<branch-slug>/QUICK_PROMPTS.md`
- Hardcode the branch name in that local file so prompts are immediate copy/paste with no placeholders.
