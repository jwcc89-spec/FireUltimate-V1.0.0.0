# Branch-Scoped Agent Handoffs

This workspace uses branch-specific handoff notes so each agent only sees context for the branch they are actively working on. Shared between Cloud agents and Cursor desktop agents to reduce context loss when switching.

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

Per branch:
- `ACTIVE_CONTEXT.md` — Single current snapshot for that branch. Keep short and high signal.
- `HANDOFF_TEMPLATE.md` (at repo root) — Template for per-session notes.
- `sessions/` — Time-stamped handoff notes from each agent session on that branch.

## Branch slug convention

- Convert git branch name to folder slug by replacing `/` with `--`.
- Example:
  - Branch: `submenu/neris-ui`
  - Folder: `agent-handoffs/branches/submenu--neris-ui/`

## Session start checklist

1. Confirm branch with the user.
2. Compute branch slug.
3. Read:
   - `cursoragent-context.md`
   - `agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md`
   - latest note under `agent-handoffs/branches/<branch-slug>/sessions/`
4. Optional: copy a starter prompt from `agent-handoffs/QUICK_PROMPTS.md`.

## Suggested workflow (during work)

1. **Create/append a session note**
   - Use file name pattern: `YYYY-MM-DD-HHMMZ-<agent-type>-<short-topic>.md`
   - Example: `2026-02-23-1330Z-cloud-neris-export-debug.md`

2. **Log only major decisions and outcomes**
   - problem found
   - fix applied
   - verification result
   - commit hash

## Session end checklist

1. Add a new timestamped note under branch `sessions/`.
2. Refresh branch `ACTIVE_CONTEXT.md` with latest truth:
   - branch and latest commit
   - current blocker(s)
   - exact next steps
   - link/reference to the new session note
3. When work is complete on a task, mark done in `ACTIVE_CONTEXT.md`; keep detailed history in `sessions/`.
4. Commit and push on the same branch.

## New branch setup (first agent only)

1. Confirm the branch name with the user.
2. Create the branch folder and sessions folder:
   - `agent-handoffs/branches/<branch-slug>/`
   - `agent-handoffs/branches/<branch-slug>/sessions/`
3. Create `ACTIVE_CONTEXT.md` from `agent-handoffs/ACTIVE_CONTEXT_TEMPLATE.md`.
4. Create first session note from `agent-handoffs/HANDOFF_TEMPLATE.md`.
5. Commit and push the handoff scaffold before feature work.

## Quality standards for handoff notes

- Include exact branch and commit hash.
- Include exact command outputs for critical failures.
- Distinguish clearly: confirmed facts, assumptions, pending external dependencies (e.g., vendor support).
- End with a short "Next agent should do this first" checklist.

## Hardcoded-per-branch option (recommended for copy/paste speed)

- Keep global prompt library in `agent-handoffs/QUICK_PROMPTS.md`.
- For frequently used branches, also create:
  - `agent-handoffs/branches/<branch-slug>/QUICK_PROMPTS.md`
- Hardcode the branch name in that local file so prompts are immediate copy/paste with no placeholders.
