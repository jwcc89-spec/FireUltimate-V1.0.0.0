# Active Context Snapshot (cursor/watseka-scheduling-plan)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`; tenant is resolved from request host (or demo on localhost).
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.

## Current branch
- `cursor/watseka-scheduling-plan` (created from the merged practice branch, PR #34, `4c80de8`)

## Current focus
- Test the Personnel Schedule with a department that works one 12-hour shift, 08:00–20:00, Monday–Friday. The operator sets the department up from scratch to judge ease of setup.
- Plan: `docs/plans/canvases/weekday-schedule-test-plan.canvas.tsx` (canvas plan; start from the step marked **Next**).

## Local test environment (this Mac only — never staging)
- Throwaway Postgres in `~/fu-local-db` (outside the repo), port **5433**, database `fu_local`. Start it with `node ~/fu-local-db/start.mjs`.
- Local API: `cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0` then `env -u DATABASE_URL node --env-file=$HOME/fu-local-db/api.env server/neris-proxy.mjs`. **Do not use `npm run proxy` for this test** — it reads `.env.server`, which points at staging.
- `~/fu-local-db/api.env` has only `NERIS_PROXY_PORT` and the local `DATABASE_URL` (no NERIS or Fire Recovery keys).
- Frontend: `npm run dev`, then `http://localhost:5173`.
- Test department: "Weekday Test Fire Department", slug `demo` in the local DB only (localhost always resolves to slug `demo`). Admin `admin` / `Weekday#2026` (throwaway).

## Latest known status
- Step 1 (local database + empty department) done. Step 2 (operator's from-scratch setup in Admin Functions) is next.
- No app code changed yet.

## Current blocker / status
- None. Waiting on the operator's setup findings.

## Known gaps found by code reading (see plan Findings tab)
- Shift recurrence has no weekday option; Daily includes weekends.
- Rotation day counting is anchored to 2026-01-01 with A/B/C name offsets (`getShiftStartOffsetDays`).
- `standardOvertimeSlot` defaults to 24 hours.
- No in-app screen to create a department (script or platform admin API only).

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md`.
2. **Do now:** Read this file, the latest note in `sessions/`, and the plan canvas.
3. Confirm the local database and both servers are running before asking the operator to click through.
4. Any schedule change must keep the 24/48 behavior identical. No Prisma schema changes without approval.
