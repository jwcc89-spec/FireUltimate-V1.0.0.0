# 2026-11-27: W7b import, call history, pre-plans

**Agent:** Claude Opus 5.5. **Branch:** `feature/demo-modules`.

## Operator asks
- Once a property is saved, don't load live Street View / Aerial on the property screen (Google cost). Load them only when adding or editing. Then continue with 7b.

## What changed
- `PropertyScreen.tsx`: no live map panels. Overview shows the thumbnail (photo, else one Street View Static image), View Pre-Plan (newest) or Add Pre-Plan, and Open in Google Maps. Incidents and Pre-Plans tabs work.
- Server: `preventionImport.mjs` (CSV import preview/commit, duplicates by cleaned address + unit, one transaction), `preventionPrePlans.mjs` (pre-plan CRUD), `GET /api/prevention/properties/:id/incidents` in `prevention.mjs`, property detail now lists pre-plans. Registered in `registerModuleRoutes.mjs`; `permissions.mjs` write rule now covers `preplans` too.
- Tests: `prevention.test.mjs` adds import, call history and pre-plan tests with second-department checks.
- Frontend: `PropertyImportDialog.tsx` + `propertyCsv.ts` (template, CSV reader, header aliases), `PropertyIncidentsTab.tsx`, `PrePlanScreen.tsx`, `prePlanTemplates.ts`, `PrePlansPage.tsx` (route `/fire-prevention/pre-plans`, menu `isBuilt: true`), `src/pages/maps/GeofenceLinkFields.tsx` used by `MapRecordForm.tsx`. CSS block "W7b" at the end of `App.css`.

## Verified
- `npm run lint` clean, `npm run build` passes, `npm test` 115 pass / 2 known local-Postgres failures.
- CSV reader checked by hand on quoted commas, doubled quotes, line breaks in quotes, a BOM, blank lines and an unknown column.

## Not done / next
- No new migration in 7b. The W7 migration (26) still needs the operator's backup + apply before merging.
- 7c Inspections, 7d NERIS picker.
