# 2026-11-27 — W7a Fire Prevention: properties, contacts, map (America/Chicago)

Agent: Claude Opus 5.5. Branch: `feature/demo-modules`. Not merged yet (migration first).

## Asked
- "approved." Answers: fixed lists OK; Schedules tab as upcoming list OK; anyone completes inspections; NERIS has only "Person"; keep the property name.

## Done
- Schema + migration `20261130100000_add_fire_prevention` (**written, not applied**): `Property`, `PropertyContact`, `PrePlan`, `Inspection` + Prisma back-links on `Tenant` and `ChecklistTemplateVersion`. Additive only (4 CREATE TABLE, indexes, foreign keys; nothing dropped or altered on existing tables). Generated with `prisma migrate diff` from a copy of the old schema.
- Server: `server/modules/prevention.mjs` (properties and contacts), `addressMatch.mjs` (address cleanup), `preventionDefaults.mjs` (fixed lists). Registered in `registerModuleRoutes.mjs`; permission lines in `permissions.mjs` (reads `incidents.view`, writes `prevention.manage`).
- Tests: `server/modules/prevention.test.mjs` (3 tests incl. second-department isolation), added to `npm test`.
- Frontend: `src/api/prevention.ts`; `src/pages/prevention/` (list + map, form with live Street View / Aerial / draggable pin / "Use this view as thumbnail" / Take Photo, property screen, contacts). Route in `RouteResolver`; Properties menu item `isBuilt: true`. CSS block at the end of `App.css`.

## Verification
- `npm run lint` and `npm run build` pass.
- `npm test`: 113 pass / 2 fail (known local Postgres).
- Not click-tested: needs the staging migration and deploy.

## Next
- Operator: backup `backup-before-w7`, `migrate deploy`, `migrate status` (26), merge, click checks.
- Then 7b (import, call history, pre-plans, geofence link picker).
