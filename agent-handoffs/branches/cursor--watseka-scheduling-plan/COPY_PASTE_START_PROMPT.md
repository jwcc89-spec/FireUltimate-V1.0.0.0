# Copy/Paste Start Prompt (cursor/watseka-scheduling-plan)

The agent states at the end of each response which agent or model was used, or that Cursor's picker should be trusted.

## Sessions vs conversations

| Folder | Audience | Content | Count |
|--------|----------|---------|-------|
| `sessions/` | Next agent | What shipped, paths, checks, next step | One note for November 3: `sessions/2026-11-03-session.md` |
| `conversations/` | User | Decisions and what is waiting | One summary: `conversations/2026-11-03-session-summary.md` |

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: cursor/watseka-scheduling-plan unless I explicitly tell you to switch.
2) Use branch slug: cursor--watseka-scheduling-plan in paths under agent-handoffs/branches/cursor--watseka-scheduling-plan/
3) Read continuity docs:
   - cursoragent-context.md
   - .cursor/project-context.md
   - agent-handoffs/branches/cursor--watseka-scheduling-plan/ACTIVE_CONTEXT.md
   - agent-handoffs/branches/cursor--watseka-scheduling-plan/sessions/2026-11-03-session.md
   - agent-handoffs/branches/cursor--watseka-scheduling-plan/conversations/2026-11-03-session-summary.md
   - docs/plans/canvases/weekday-schedule-test-plan.canvas.tsx
   - shared plan: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/07bcb2d0-f8d5-448e-9b16-a5473b749ecc (republish to this same canvas id; do not put a password in it)
4) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/system_architecture.md and docs/data_model.md when touching data
5) This test uses the throwaway database on this Mac only (~/fu-local-db, port 5433, database fu_local). Never run npm run proxy for it. Never touch staging, production, or Crescent. Do not reset the admin password.
6) Before coding, summarize:
   - current branch and latest commit
   - Stage A is done; Steps 8–13 passed the click-test; Step 3 is next and is not approved yet
   - exact next step (Step 3 only after the user approves the Selected weekdays wording and layout)
   - Now vs Later: wait for that approval now; rotation start date and staging later
7) Follow beginner-friendly communication with numbered click steps.
8) After meaningful changes, update ACTIVE_CONTEXT.md, the session note, and the repo canvas. Republish that canvas to the same shared link.
9) Before stopping, commit and push on cursor/watseka-scheduling-plan when asked, and report the branch, commit hash, and next step.

After acknowledging the rules above:
1) Continue from Step 3 only after the user approves the layout. Do not rebuild solved schedule or trades work.
2) Pull latest cursor/watseka-scheduling-plan.
3) Lint and build after app or server edits.
```
