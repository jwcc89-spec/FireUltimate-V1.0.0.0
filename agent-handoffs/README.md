# Branch-Scoped Agent Handoffs

This workspace uses branch-specific handoff notes so each agent only sees context for the branch they are actively working on.

## Folder layout

```
agent-handoffs/
  HANDOFF_TEMPLATE.md
  branches/
    <branch-slug>/
      ACTIVE_CONTEXT.md
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

## Session end checklist

1. Add a new timestamped note under branch `sessions/`.
2. Refresh branch `ACTIVE_CONTEXT.md` with latest truth:
   - branch and latest commit
   - current blocker/status
   - exact next steps
3. Commit and push on the same branch.
