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
- Repair plan canvas: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136 (repo copy: `docs/plans/canvases/repair-plan.canvas.tsx`). Canvas plans are the standard; see `.cursor/rules/planning-canvas.mdc`.
- Stage A (Steps 1–4) complete. Stage B Steps 5, 6, 7, and 8 are built on this branch and are not deployed.
- Step 5: sign-in passes live in `Session` (fingerprint only). Idle limit is 60 minutes from the last request. Lockout is 15 minutes after 5 wrong passwords. Closing the browser signs the person out. Logout clears cached department data.
- Step 6: `RolePermission` and `AccountAuditLog` are add-only. Sending a NERIS report, sending a NERIS report for billing, and creating an incident by hand are admin-only by default. A department admin can lower a permission to their own role or lower. Department settings saves do not change accounts.
- Step 7: department comes from the Host header. `X-Forwarded-Host` is ignored unless `TRUST_PROXY=1` (leave off). Two-department tests cover incidents, reports, accounts, settings, billing, schedule, and CAD email. NERIS calls use only that department's entity ID.
- Step 8: package upgrades. `npm audit` is clean. No database change. Prisma stayed on 7.x.
- Design canvas: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/a9d0e635-88a9-45c5-89c8-ab93873f7618
- Next: Step 9 (automatic checks and the release checklist). The checklist wording is waiting on approval. Do not apply the Session, RolePermission, or AccountAuditLog migrations to staging or production without an explicit release approval and a fresh backup. Do not merge the practice branch into staging until those tables exist there. Do not set `TRUST_PROXY=1` until Render is confirmed to replace `X-Forwarded-Host`.

## Latest known status
- Base commit: `2d985fa` - `feat(ui): Setup/Configuration, Fire Recovery tenant JWT only`
- Re-verified 2026-10-29 (UTC): `main` (`3f9b97a`) has no code that `submenu/neris-golive-cifpd` lacks; its 5 extra commits are merge records. A throwaway merge of `main` into the staging branch produced a zero-line difference.
- On this branch after Steps 7 and 8: `npm run lint` pass, `npm run build` pass, `npm test` 16/16 pass against local Postgres only, `npm audit` 0 vulnerabilities.

## Current blocker / status
- No code blocker. Tests use throwaway local database `fu_session_test` on 127.0.0.1, never Neon. `npm test` needs that local Postgres running.
- Open items that are not Step 9: confirm the Fire Recovery Welcome Message email; approve Step 15 Reporting tab changes; one combined Fire Recovery email after sandbox testing (Step 17); decide whether each department gets its own NERIS login before more departments join.

## External dependency status
- Render, Neon, Cloudflare: not touched by this branch. No production or Render setting changes without user approval.
- Backups exist from 2026-10-28: `backup-2026-10-28-before-repairs` (prod) and `backup-2026-10-28-before-repairs-staging` (staging).

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md`.
2. **Do now:** Read this file and the latest note in `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/`.
3. When touching architecture, data, or integrations: read `docs/system_architecture.md`, `docs/data_model.md`, `docs/agent-execution-contract.md`; for incident/report/export: `docs/incident-lifecycle.md`; for CAD/NERIS/NEMSIS: `docs/integrations.md`.
4. Stay on `cursor/stage-b-foundation-b5ff` unless the user says otherwise.
5. **Do not** merge into staging until Session, RolePermission, and AccountAuditLog are applied there with a backup.
