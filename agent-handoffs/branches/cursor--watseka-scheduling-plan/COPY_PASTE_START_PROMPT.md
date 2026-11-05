# Copy/Paste Start Prompt (cursor/watseka-scheduling-plan)

The agent states at the end of each response which agent or model was used, or that Cursor's picker should be trusted.

## Sessions vs conversations

| Folder | Audience | Content | Count |
|--------|----------|---------|-------|
| `sessions/` | Next agent | What shipped, paths, checks, next step | Latest: `sessions/2026-11-04-production-release.md` |
| `conversations/` | User | Decisions and what is waiting | `conversations/2026-11-03-session-summary.md` |

```text
Before doing any feature work, understand the Branch Rules:

1) Stay on branch: cursor/watseka-scheduling-plan unless I explicitly tell you to switch.
2) Use branch slug: cursor--watseka-scheduling-plan in paths under agent-handoffs/branches/cursor--watseka-scheduling-plan/
3) Read continuity docs:
   - cursoragent-context.md
   - .cursor/project-context.md
   - agent-handoffs/branches/cursor--watseka-scheduling-plan/ACTIVE_CONTEXT.md
   - agent-handoffs/branches/cursor--watseka-scheduling-plan/sessions/2026-11-04-production-release.md
   - docs/plans/canvases/weekday-schedule-test-plan.canvas.tsx
   - docs/plans/security-remediation-plan.md (production has Stage B from November 1–2 via PR #37 / 6efda0e)
   - shared weekday plan: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/07bcb2d0-f8d5-448e-9b16-a5473b749ecc
4) Read and follow before any edits:
   - docs/agent-execution-contract.md
   - docs/task-2-multitenant-domain-plan.md
   - docs/system_architecture.md and docs/data_model.md when touching data
5) Weekday feature code is already on staging and production (PR #37 / 6efda0e). Local throwaway DB (~/fu-local-db, port 5433, fu_local) is for experiments only. Never run npm run proxy for that. .env.server is staging; .env.production is production.
6) Before coding, summarize:
   - current branch and latest commit
   - weekday plan complete through production; next optional work is watsekafire.fireultimate.app
   - Stage B security and Stage C Fire Recovery code are on production; billing stays off
   - Now vs Later
7) Follow beginner-friendly communication with numbered click steps.
8) After meaningful changes, update ACTIVE_CONTEXT.md, the session note, and the repo canvas.
9) Before stopping, commit and push on cursor/watseka-scheduling-plan when asked, and report the branch, commit hash, and next step.

After acknowledging the rules above:
1) Do not rebuild the weekday schedule feature or Stage B security.
2) Create watsekafire on production only when the user asks, using .env.production only.
3) Leave FIRE_RECOVERY_MODE unset. Add Crescent production Allowed Senders before CAD ingest is relied on.
4) Lint and build after app or server edits.
```
