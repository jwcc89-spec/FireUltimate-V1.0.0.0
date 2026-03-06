# Active Context Snapshot (submenu/departmentdetails-ui)

## Current branch
- `submenu/departmentdetails-ui`

## Current focus
- Task 2 multi-tenant: Wave 1 and Wave 2 complete. Next: Wave 3 (auth model cleanup — `/api/users`, stop storing auth in DepartmentDetails.payloadJson, migrate Department Access UI).

## Latest known status
- Latest commit (before this session end): `6c454e7` — Implement Task 2 auth hardening, tenant docs, and agent execution contract.
- This session: Wave 1 (tenant strategy, Operator Runbook, remove file helpers, DEMO = persistent sandbox); Wave 2 (tenant:create script, admin API); docs (admin-api-beginner-guide, execution contract, “Agent used” in each response).
- Working tree: has uncommitted changes (session note, ACTIVE_CONTEXT, conversation summary, and any Wave 1/2/docs files not yet committed). Commit + push at session end.
- Build/lint: passing (`npm run lint` run during session).

## Current blocker / status
- No functional blocker. User ending session; handoff in progress.

## External dependency status
- No new package dependencies this session. `PLATFORM_ADMIN_KEY` is optional in `.env.server` for admin API.

## Recent key commits (latest first)
- `6c454e7` Implement Task 2 auth hardening, tenant docs, and agent execution contract
- (Earlier: bda3f6f, caa43ee, etc.)

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read `docs/agent-execution-contract.md` and `docs/task-2-multitenant-domain-plan.md`.
4. Read latest session note: `agent-handoffs/branches/submenu--departmentdetails-ui/sessions/2026-03-06-session-end-handoff.md`.
5. At end of each response, state **Agent used for this response:** (per execution contract).
6. When user is ready, continue with **Wave 3** (dedicated `/api/users` endpoints, migrate Department Access UI off payload auth).
