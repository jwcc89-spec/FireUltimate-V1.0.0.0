# Agent Handoff Note — Wave 3 Auth Cleanup

## Session metadata
- Date (UTC): 2026-03-07
- Agent type: Auto (Cursor)
- User request: Verify branch sync, validate, report, then start Wave 3.
- Working branch: `submenu/departmentdetails-ui`

## Starting context
- Branch verified synced with origin at `94dab6e`.
- Lint run and passed.
- Wave 3 scope: dedicated `/api/users`, stop storing auth in DepartmentDetails.payloadJson, migrate Department Access UI.

## Work completed (Wave 3)
1. **API**
   - Added GET `/api/users` — list tenant users (no password in response).
   - Added POST `/api/users` — create user (username, password, userType); 409 if username exists.
   - Added PATCH `/api/users/:id` — update username/password/userType; tenant-scoped.
   - Added DELETE `/api/users/:id` — delete user; tenant-scoped.
2. **Department Access UI**
   - Load users from GET `/api/users` when loading department details; fallback to payload `userRecords` if API unavailable.
   - Added optional `id` to `DepartmentUserRecord` for PATCH/DELETE.
   - Save new user via POST `/api/users`, edit via PATCH `/api/users/:id` (resolve id from list when missing for legacy records).
   - Omitted `userRecords` from department-details save payload so auth is never sent to or stored in payloadJson.
3. **Auth / payload**
   - Login uses `User` table only; removed legacy login fallback from DepartmentDetails.payload.
   - GET `/api/department-details`: strip `userRecords` from response.
   - POST `/api/department-details`: strip `userRecords` from payload before persisting (never store auth in payloadJson).

## Files changed
- `server/neris-proxy.mjs` — users routes, login fallback removed, department-details read/write strip userRecords.
- `src/App.tsx` — DepartmentUserRecord.id, load users from /api/users, saveUserForm uses POST/PATCH /api/users, payload omits userRecords.
- `docs/task-2-multitenant-domain-plan.md` — Wave 3 done noted in Phase 4.
- `agent-handoffs/branches/submenu--departmentdetails-ui/ACTIVE_CONTEXT.md` — updated for Wave 3 complete.
- `agent-handoffs/branches/submenu--departmentdetails-ui/sessions/2026-03-07-wave3-auth-cleanup.md` (this file).

## Verification
- `npm run lint`: pass.
- No targeted API test run in this session; user can test login and Department Access (add/edit user, save department details).

## Next steps
- Wave 4: change-password UX + password policy (when approved).
- Commit + push Wave 3 changes on `submenu/departmentdetails-ui` when user is ready.
