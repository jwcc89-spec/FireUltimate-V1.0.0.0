# Active Context Snapshot (submenu/departmentdetails-ui)

## Current branch
- `submenu/departmentdetails-ui`

## Current focus
- Crash-hardening refactor to reduce `src/App.tsx` size and Cursor instability while preserving existing Department Details and Scheduler behavior.

## Latest known status
- Latest commit: `bda3f6f` - Updated UI for Scheduler, Split Department Details Modules, Reduced App.tsx size.
- Working tree status: clean (`git status --short` returned no changes).
- Major extraction pass completed and validated:
  - `src/NerisFlatSelects.tsx` (flat select components)
  - `src/NerisGroupedOptionSelect.tsx` (grouped NERIS select)
  - `src/PersonnelSchedulePage.tsx` (schedule page)
  - `src/pages/NerisReportFormPage.tsx` (large NERIS report form page)
- `src/App.tsx` reduced to `8044` lines / `298075` bytes.
- Build/lint status at session end: passing (`npm run build`, `npm run lint`).

## Current blocker / status
- No functional blocker currently reported.
- User completed push flow after resolving HTTPS credential/PAT issue.

## External dependency status
- No new package/runtime dependencies added.
- Existing non-fatal warnings remain:
  - npm warning about unknown env config `devdir`
  - Vite chunk size warning on production build

## Recent key commits (latest first)
- `bda3f6f` Updated UI for Scheduler, Split Department Details Modules, Reduced App.tsx size
- `caa43ee` UI updates to Scheduler-Department Details Seperated
- `f787756` Changes to Scheduler, UI updates
- `113dd16` Update ACTIVE_CONTEXT
- `bb8f57b` Fix Lint/Build Issues with PR

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read latest note in `agent-handoffs/branches/submenu--departmentdetails-ui/sessions/`.
4. Ask user for first validation result from tomorrow's testing pass (especially Schedule month/day block interactions, OT/undo behavior, and NERIS report page flows).
