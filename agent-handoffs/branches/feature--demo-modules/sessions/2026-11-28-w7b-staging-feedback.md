# 2026-11-28: W7b staging feedback round

**Agent:** Claude Opus 5.5. **Branch:** `feature/demo-modules`.

Operator applied migration 26 (no pending), merged 7a/7b, and tested on `kankdemo.staging.fireultimate.app`.

## Changed
- Fire Prevention menu order: Properties, Pre-Plans, Inspections, Smoke Alarms, Permits, Fire Investigations (`src/appData.ts`).
- Occupancy list: added "Fire Department" (client `src/api/prevention.ts` and server `preventionDefaults.mjs`).
- Property form: Google address suggestions while typing (`AddressSuggestInput.tsx`, suggestions only); the Census lookup still sets the pin and fills a blank ZIP. `APIProvider` now wraps the whole form.
- Property screen: one tab row (Details/Contacts left, five record tabs right), one panel; `&tab=` query param.
- Pre-Plans page: New Basic / New Complex buttons with a property picker dialog.
- Pre-plan screen: pinned header (`.preplan-sticky`), collapsible sections collapsed by default (`PrePlanSections.tsx`, shared), Print opens all sections, mm/dd/yyyy dates.
- `NerisFlatSingleOptionSelect` (shared): the panel is positioned before its first paint, repositions on scroll/resize, and closes when its field scrolls out of view.
- Geofences: picking a property fills its newest pre-plan; geofence popup tabs are Information, Pre-Plan (`GeofencePrePlanTab.tsx`), Documents.
- Plan: parked notes for the Display Board rig/takeover idea, CSV update of existing properties, Prisma 8.

## Verified
- `npm run lint` clean, `npm run build` passes, `npm test` 115 pass / 2 known failures.

## Next
- Operator rechecks on staging; answer on CSV update behavior; then 7c Inspections.
