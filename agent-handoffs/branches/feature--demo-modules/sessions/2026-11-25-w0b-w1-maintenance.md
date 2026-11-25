# Agent Handoff Note

## Session metadata
- Date: 2026-11-25 (Chicago afternoon)
- Agent type: Cursor Desktop
- User request focus: do W0b and W1 one after the other, commit each, then merge into `submenu/neris-golive-cifpd` and push.
- Working branch: `feature/demo-modules`

## Starting context
- Latest commit at start: `34e733b`.
- Known blockers at start: the W0 `Comment` migration was not yet confirmed as applied to staging.

## Work completed
- **W0b** (`e43ebe3`): hide-sidebar button.
  - `ShellLayout` in `src/App.tsx` has a `sidebarHidden` state, saved in localStorage under `fu.sidebarHidden`.
  - `src/App.css` adds `.shell-layout.sidebar-hidden`, which only applies above 1024 px. The button is hidden at 1024 px and below, so the mobile menu is untouched.
- **W1** (`b4afbec`): Maintenance.
  - Schema plus migration `20261126100000_add_maintenance`, generated with `prisma migrate diff`. It is additive only.
  - Routes in `server/modules/maintenance.mjs`, registered from `registerModuleRoutes.mjs`, with mappings in `permissionForRequest`.
  - Pages in `src/pages/maintenance/`, the shared table `src/components/ModuleTable.tsx`, and the lookups `src/moduleLookups.ts`.
- **Decisions:** see the "W0b and W1 as built" note in `docs/plans/demo-week-build-plan.md`. In short:
  - Default types are copied per department, so tenants stay isolated.
  - Records and types have a `description` column.
  - The asset list lives in `detailsJson.assets`.
  - Attachments are data URLs until R2 storage exists.

## Verification
- `npm run lint`: passes.
- `npm run build`: passes.
- `npm test`: 81 of 83 pass. The 2 failures are the known local-Postgres tests.
- New `server/modules/maintenance.test.mjs` checks these against an in-memory database:
  - A second tenant cannot list, read, edit, comment on or delete the first tenant's records, vendors, equipment or types.
  - A user cannot close, reopen or edit someone else's record.
  - Completing a record needs a date and a performer.
  - Default types are per department, and system types cannot be deleted.
  - The permission mapping is correct.
- **Not done:** a live browser or curl check. The only database is Neon staging, and the migration is not applied there yet.

## Git status
- `e43ebe3` W0b, `b4afbec` W1, plus a handoff commit. Pushed to `feature/demo-modules`, merged into `submenu/neris-golive-cifpd`, and pushed.

## Open issues / blockers
- The operator must apply the migrations to staging. Until then the maintenance pages show a load error, and nothing else is affected.

## Next steps for next agent
1. Confirm with the user that both migrations are applied and the maintenance click-through passed.
2. Start W2 (maps). It needs `VITE_GOOGLE_MAPS_API_KEY` and new libraries (`@vis.gl/react-google-maps`, Terra Draw, Turf). Ask for library approval at the start of W2.
3. W3's display board reads open `MaintenanceRecord` rows with `outOfService: true` and lists `detailsJson.assets`.
