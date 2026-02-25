# Active Context Snapshot (submenu/departmentdetails-ui)

## Current branch
- submenu/departmentdetails-ui

## Current focus
- Department Details: persistence file, Personnel Qualifications UX, Minimum Requirements label, dropdown scroll, alphabetical sorting.

## Latest known status
- Latest commit: (pending) - Data persistence, Personnel Qualifications Add, Minimum Requirements, (select all that apply), dropdown scroll, Stations/Apparatus sort.
- API integration: `/api/department-details` GET on load, POST on save. Server stores in `data/department-details.json`.
- Lint and build: passing.

## Current blocker / status
- No blocker.

## External dependency status
- 

## Recent key commits (latest first)
- d06e2ae ACTIVE_CONTEXT + session note: add commit 88a4562
- cc7df5f Edit Stations, Shift Information, Personnel Qualifications → CLICKABLE-LIST
- c5fd5d7 Revise guidelines for session management and validation
- 6e9ef95 Update handoff template for clarity and formatting
- 3f56271 Align Department Details DD-M fields to NERIS Additional Incident Types style
- bf26a49 Add Department Details API persistence (GET/POST) with localStorage fallback
- 74fd7e6 Add Department Details admin submenu UI scaffold

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read latest note in `agent-handoffs/branches/submenu--departmentdetails-ui/sessions/`.
4. Implement additional validation for multi-entry popups as user provides required fields.
