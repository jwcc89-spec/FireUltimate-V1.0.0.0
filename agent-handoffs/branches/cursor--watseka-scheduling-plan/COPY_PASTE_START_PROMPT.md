# Copy/Paste Start Prompt (cursor/watseka-scheduling-plan)

The agent states at the end of each response which agent or model was used, or that Cursor's picker should be trusted.

## Sessions vs conversations

| Folder | Audience | Content | Count |
|--------|----------|---------|-------|
| `sessions/` | Next agent | What shipped, paths, checks, next step | One note for November 3: `sessions/2026-11-03-session.md` |
| `conversations/` | User | Decisions and the open click-test | One summary: `conversations/2026-11-03-session-summary.md` |

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
   - docs/plans/canvases/weekday-schedule-test-plan.canvas.tsx (Stage D is the trades plan)
4) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/system_architecture.md and docs/data_model.md when touching data
5) This test uses the throwaway database on this Mac only (~/fu-local-db, port 5433, database fu_local). Never run npm run proxy for it. Never touch staging, production, or Crescent. Do not reset the admin password.
6) Before coding, summarize:
   - current branch and latest commit
   - Steps 8–11 passed the click-test; Step 12 is built; the Step 12 click-test result is the blocker
   - exact next step (Step 13 only after the Step 12 click-test is accepted)
   - Now vs Later: wait for the Step 12 click-test now; Step 13 and weekday recurrence later
7) Follow beginner-friendly communication with numbered click steps.
8) After meaningful changes, update ACTIVE_CONTEXT.md, this session note, and the canvas. Copy the canvas to the live canvas path on this Mac.
9) Before stopping, commit and push on cursor/watseka-scheduling-plan when asked, and report the branch, commit hash, and next step.

After acknowledging the rules above:
1) Continue from the Step 12 click-test. Do not rebuild solved schedule or trades work.
2) Pull latest cursor/watseka-scheduling-plan.
3) Lint and build after app or server edits.
```
