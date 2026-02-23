# Agent Handoff Workspace

Use this folder as the shared, versioned source of truth between:
- Cloud agents
- Cursor desktop agents

The goal is to reduce context loss when switching agents.

## Folder layout

- `ACTIVE_CONTEXT.md`
  - Single current snapshot of the project state.
  - Keep this short and high signal.
- `HANDOFF_TEMPLATE.md`
  - Template for per-session notes.
- `sessions/`
  - Time-stamped handoff notes from each agent session.

## Suggested workflow (best practice)

1. **At session start**
   - Read:
     - `cursoragent-context.md`
     - `agent-handoffs/ACTIVE_CONTEXT.md`
     - Most recent file(s) in `agent-handoffs/sessions/`
   - Confirm working branch with the user.

2. **Create/append a session note**
   - Use file name pattern:
     - `YYYY-MM-DD-HHMMZ-<agent-type>-<short-topic>.md`
   - Example:
     - `2026-02-23-1330Z-cloud-neris-export-debug.md`

3. **During work**
   - Log only major decisions and outcomes:
     - problem found
     - fix applied
     - verification result
     - commit hash

4. **Before ending session**
   - Update `ACTIVE_CONTEXT.md` with:
     - current branch
     - latest commit
     - current blocker(s)
     - exact next step
   - Add link/reference to the new session note.

5. **When work is complete**
   - Mark done in `ACTIVE_CONTEXT.md`
   - Keep detailed history in `sessions/`

## Quality standards for handoff notes

- Include exact branch and commit hash.
- Include exact command outputs for critical failures.
- Distinguish clearly:
  - confirmed facts
  - assumptions
  - pending external dependencies (e.g., vendor support)
- End with a short "Next agent should do this first" checklist.
