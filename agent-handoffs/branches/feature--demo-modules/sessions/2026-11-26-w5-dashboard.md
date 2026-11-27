# 2026-11-26 late — W5 Dashboard (America/Chicago)

Agent: Claude Opus 5.5. Branch: `feature/demo-modules`. Not merged yet (migration first).

## Asked
- Start W5 Dashboard (drag/resize widgets, saved layouts), then W6.
- Approved the `DashboardLayout` table as proposed; add widgets **Trades - Active Requests** and **Calendar**.

## Done
- Migration `20261128100000_add_dashboard_layout` (written, **not applied**). Schema model `DashboardLayout` + `Tenant.dashboardLayouts`.
- `server/modules/dashboard.mjs`: layout get/save/reset, department default (`displays.manage`), summary (apparatus, on duty, maintenance). Registered in `registerModuleRoutes.mjs`; mapping in `permissions.mjs`.
- Exported `boardDate` (displays.mjs) and `OPEN_STATUSES` (maintenance.mjs) for reuse; no behavior change.
- `server/modules/dashboard.test.mjs` (5 tests) added to `npm test`.
- Frontend: `react-grid-layout` 2.x; `src/api/dashboard.ts`; `src/pages/dashboard/` (page, widgets, catalog); App.tsx `DashboardPage` replaced by a wrapper that keeps the Alerts card and submenu cards. Old show/hide list and sample stats removed.
- Dashboard CSS block at the end of `App.css`.

## Verification
- `npx prisma validate`, `npx tsc -b`, `npm run lint`, `npm run build` pass.
- `npm test`: 104 pass / 2 fail (known local Postgres).
- Not click-tested: needs the staging migration and deploy.

## Not done / next
- Apply the migration to staging (Neon backup first), merge into `submenu/neris-golive-cifpd`, operator click checks.
- W6 Policies: needs a seven-table schema approval.
- Calendar widget reads `DisplayEvent` until a real Calendar module exists. DTB's widget is a placeholder until W6.
