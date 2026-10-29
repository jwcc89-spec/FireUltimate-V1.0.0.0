# Active Context Snapshot (cursor/stage-b-foundation-b5ff)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`; tenant is resolved from request host (or demo on localhost).
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.

## Current branch
- `cursor/stage-b-foundation-b5ff` (practice/work branch)
- Created from `submenu/neris-golive-cifpd` at `2d985fa` (the version staging runs).
- PRs from this branch target `submenu/neris-golive-cifpd`, never `main` directly. `main` is what production runs and only changes in a planned release.

## Current focus
- Repair plan (canvas "Fire Ultimate — Beginner Repair Plan"), Stage A Step 4 complete on the code side.
- Waiting on the user's answers to the open questions in the plan's Decisions tab.
- Next: Stage B Step 5 (server-side sign-in pass / session authentication) — requires explicit approval because it changes authentication logic.

## Latest known status
- Base commit: `2d985fa` - `feat(ui): Setup/Configuration, Fire Recovery tenant JWT only`
- Re-verified 2026-10-29 (UTC): `main` (`3f9b97a`) has no code that `submenu/neris-golive-cifpd` lacks; its 5 extra commits are merge records. A throwaway merge of `main` into the staging branch produced a zero-line difference.
- Baseline on this branch: `npm run lint` pass, `npm run build` pass, `npm test` 15/15 pass.

## Current blocker / status
- No code blocker. Waiting on user decisions (Decisions tab) and approval to start Step 5.

## External dependency status
- Render, Neon, Cloudflare: not touched by this branch. No production or Render setting changes without user approval.
- Backups exist from 2026-10-28: `backup-2026-10-28-before-repairs` (prod) and `backup-2026-10-28-before-repairs-staging` (staging).

## Recent key commits (latest first)
- `2d985fa` `feat(ui): Setup/Configuration, Fire Recovery tenant JWT only`

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md`.
2. **Do now:** Read this file and the latest note in `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/`.
3. When touching architecture, data, or integrations: read `docs/system_architecture.md`, `docs/data_model.md`, `docs/agent-execution-contract.md`; for incident/report/export: `docs/incident-lifecycle.md`; for CAD/NERIS/NEMSIS: `docs/integrations.md`.
4. Confirm branch with user and continue from current blocker only.
5. Follow the plan's Data safety tab: no Prisma schema, migration, or auth changes without explicit approval; no Render/production changes.
