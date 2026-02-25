# Active Context Snapshot (submenu/departmentdetails-ui)

## Current branch
- submenu/departmentdetails-ui

## Current focus
- Department Details: CLICKABLE-LIST patterns, dropdown scroll fixes, persistence, Unit Type scroll styling as reference.

## Latest known status
- Latest commit: 2ecffa4 - Match Minimum Requirements and Qualifications scroll styling to Unit Type.
- API integration: `/api/department-details` GET on load, POST on save. Server stores in `data/department-details.json`.
- Lint and build: passing.
- Unit Type (Apparatus Entry) scroll works correctly; do not change. Minimum Requirements and Qualifications use same scroll styling.

## Current blocker / status
- No blocker.

## External dependency status
- 

## Recent key commits (latest first)
- 2ecffa4 Match Minimum Requirements and Qualifications scroll styling to Unit Type
- 1221c57 Fix dropdown scroll: prevent page scroll when scrolling inside dropdowns
- 752e361 Fix Apparatus Save, Minimum Requirements, dropdown scroll/clipping
- db82d1a Fix Personnel Qualifications dropdown clipping; Apparatus Minimum Requirements hint
- f6074cf Mutual Aid dropdown scroll fix; User Type → CLICKABLE-LIST
- d6a763c Department Details: persistence, Personnel Qualifications UX, Minimum Requirements, dropdown scroll, sort
- cc7df5f Edit Stations, Shift Information, Personnel Qualifications → CLICKABLE-LIST

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read latest note in `agent-handoffs/branches/submenu--departmentdetails-ui/sessions/`.
4. Implement additional validation for multi-entry popups as user provides required fields.
