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
- Next: Stage C (Fire Recovery) when the user asks. Steps 9, 9A, and 9B are built on this branch and are not deployed. GitHub runs lint, build, and tests on a throwaway Postgres. Do not apply Session, RolePermission, AccountAuditLog, or NerisReportChange to staging or production without an explicit release approval and a fresh backup. Do not merge the practice branch into staging until those tables exist there. Do not set `TRUST_PROXY=1` until Render is confirmed to replace `X-Forwarded-Host`. Do not set `NODE_ENV=production` until a planned release.

## Latest known status
- Base commit: `2d985fa` - `feat(ui): Setup/Configuration, Fire Recovery tenant JWT only`
- Re-verified 2026-10-29 (UTC): `main` (`3f9b97a`) has no code that `submenu/neris-golive-cifpd` lacks; its 5 extra commits are merge records. A throwaway merge of `main` into the staging branch produced a zero-line difference.
- On this branch after Steps 7 and 8: `npm run lint` pass, `npm run build` pass, `npm test` 16/16 pass against local Postgres only, `npm audit` 0 vulnerabilities.

## Current blocker / status
- No code blocker. Tests use throwaway local database `fu_session_test` on 127.0.0.1, never Neon. `npm test` needs that local Postgres running.
- NERIS (decided October 30): departments do not log in. One vendor key stays on the server. Each department exports only under the NERIS Entity ID an admin sets in Admin Functions. Saving that screen must update the ID export uses. Today a later change on that screen can leave export on the old ID; fix that in 9A.
- 9A (built October 30, not released): server refuses edits to In Review and Exported reports. Anyone who can edit reports can unlock an In Review report. Only an admin can unlock an Exported report. Conflict message is enforced. `NerisReportChange` stores who, when, report, and field names only, kept forever, shown inside that report. Delete requires unlock and is admin-only. Saving the NERIS Entity ID updates the ID export uses.
- 9B (built October 30, not applied to Render): admin and demo accounts kept. `NODE_ENV=production` is only in the release checklist. Logo (500 KB), workflow states, submenu visibility, and submenu cards are in `sharedDepartmentSettings`. Incident layout and sidebar width stay personal. Shift trades wait.
- Live plan canvas was republished October 30 from the repo copy. Update both after every step.
- Open items: Fire Recovery Welcome Message email; Step 15 Reporting tab changes; one combined Fire Recovery email after sandbox testing (Step 17).

## External dependency status
- Render, Neon, Cloudflare: not touched by this branch. No production or Render setting changes without user approval.
- Backups exist from 2026-10-28: `backup-2026-10-28-before-repairs` (prod) and `backup-2026-10-28-before-repairs-staging` (staging).

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md`.
2. **Do now:** Read this file and the latest note in `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/`.
3. When touching architecture, data, or integrations: read `docs/system_architecture.md`, `docs/data_model.md`, `docs/agent-execution-contract.md`; for incident/report/export: `docs/incident-lifecycle.md`; for CAD/NERIS/NEMSIS: `docs/integrations.md`.
4. Stay on `cursor/stage-b-foundation-b5ff` unless the user says otherwise.
5. **Do not** merge into staging until Session, RolePermission, and AccountAuditLog are applied there with a backup.
