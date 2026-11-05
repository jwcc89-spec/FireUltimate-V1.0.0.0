# Active Context Snapshot (cursor/watseka-scheduling-plan)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma. Do not upgrade Prisma.
- **Tenancy:** Every tenant-scoped read and write uses `tenantId`. On this Mac, `localhost` is the `demo` tenant. That tenant is the throwaway "Weekday Test Fire Department," not Crescent.
- **Time format:** 24-hour times everywhere. The only short-clock exception already built is the Info and Trades coverage lines (`8A-2P`).
- **Details:** `docs/system_architecture.md`, `docs/data_model.md`, `cursoragent-context.md`, `.cursor/project-context.md`.

## Current branch
- `cursor/watseka-scheduling-plan`. Folder slug: `cursor--watseka-scheduling-plan`.
- Session ended November 4, 2026, evening America/Chicago. Feature code is on `main` at merge `6efda0e` (PR #37 from `submenu/neris-golive-cifpd`). Staging tip for the feature is `b52c3a4`. Confirm with `git log -1` after pull.
- This practice branch still holds handoff and plan updates. Do not rebuild the weekday schedule. Do not upgrade Prisma or Node for the `@prisma/streams-local` engine warning.
- The user is driving this Mac with Cursor Remote Control. Keep editing here. A cloud agent is only a backup if this chat is lost.

## Current focus
- Weekday 12-hour schedule plan is complete through staging and production release. Next product work is creating the Watseka production hostname `watsekafire.fireultimate.app` (new empty tenant). Staging Watseka stays at `watsekademo.staging.fireultimate.app`.
- Shared plan link: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/07bcb2d0-f8d5-448e-9b16-a5473b749ecc (canvas id `07bcb2d0-f8d5-448e-9b16-a5473b749ecc`). Repo copy is the source of truth. Republish after plan edits. Do not put passwords in it.
- Latest session note: `agent-handoffs/branches/cursor--watseka-scheduling-plan/sessions/2026-11-04-production-release.md`
- Gap analysis canvas (local IDE): `canvases/staging-vs-production-gap.canvas.tsx` under the Cursor project folder.

## Latest known status
- Local click-tests: Steps 3–6 and 8–20 passed November 4, including Step 4 Rotation starts on.
- Staging: backup `backup-2026-11-04-before-weekday-schedule`. Migrations applied. Code `b52c3a4` on `submenu/neris-golive-cifpd`. Watseka staging click-test passed. Crescent staging schedule still opened.
- Production: backup `backup-2026-11-04-before-production-weekday`. Migrations applied with `.env.production` (Session, RolePermission/AccountAudit, NerisReportChange, Fire Recovery submit status, TradeRequest, QualificationOverrideRequest). PR #37 merged to `main` as `6efda0e`.
- Render production first build failed with `EBADENGINE` on `@prisma/streams-local` under Node 20. Fixed by setting **fireultimate-api-prod** Build Command to `npm ci --engine-strict=false && npm run build` (same as staging). Deploy then succeeded. Do not upgrade Node or Prisma. Do not add a dashboard `NODE_ENV` variable.
- Crescent production check November 4 evening: NERIS reports still present for CIFPDIL. Schedule remains unused/off for Crescent. Trades screens appear. Leave Fire Recovery off (`FIRE_RECOVERY_MODE` unset). Leave CAD auto-create off unless a department turns it on.
- Production database tenants before Watseka create: `cifpdil`, `demo` only. No `watsekafire` tenant yet.

## This Mac's test runtime
- Repo: `/Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`
- Throwaway database: `~/fu-local-db`, port 5433, database `fu_local`. Start with `node ~/fu-local-db/start.mjs`.
- Local API: `env -u DATABASE_URL node --env-file=$HOME/fu-local-db/api.env server/neris-proxy.mjs` on port 8787.
- Screens: `npm run dev` then `http://localhost:5173`.
- **Never run `npm run proxy` for the local weekday test.** `.env.server` is staging. `.env.production` is production.
- Local admin password was changed by the user. Do not reset or guess it.

## What is already decided
- Scheduler Settings path is **Admin Functions → Scheduler Settings** (not under Setup/Configuration).
- Trades and qualification override requests are additive tables. Staging and production both have them.
- Require approval before canceling a trade defaults on (`tradeCancelApproval !== false`).
- Rotation starts on is optional per shift. Blank keeps January 2026 A/B/C. Selected weekdays ignore it.
- Fire Recovery submit refuses when `FIRE_RECOVERY_MODE` is unset. Do not set live mode until the vendor answers and a sandbox test pass.
- Watseka production slug/hostname plan: `watsekafire` / `watsekafire.fireultimate.app`, status `trial`, created with `tenant:create` against `.env.production` only.

## Now vs later
- **Now:** session closed. Handoff docs updated. Next user work is create `watsekafire` on production and wire Cloudflare/Render DNS if they want the Watseka demo on the live domain.
- **Later:** Fire Recovery Wave 7/8. Copying staging Watseka data into production is not automatic; rebuild settings in the new tenant unless a separate copy is approved.

## Next agent should do this first
1. Read this file. Do not rebuild Steps 3–20.
2. If creating Watseka production: use `.env.production` only with `tsx scripts/tenant-create.ts`, then Render custom domain + Cloudflare CNAME for `watsekafire.fireultimate.app`, then `GET /api/tenant/context`.
3. Keep Fire Recovery off. Do not upgrade Prisma.
4. Update this file and the weekday plan canvas together when status changes. Republish canvas id `07bcb2d0-f8d5-448e-9b16-a5473b749ecc`.
