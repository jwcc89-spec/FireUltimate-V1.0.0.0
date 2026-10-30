# Session note — Steps 9, 9A, and 9B built

Date: 2026-10-30 (America/Chicago)

## What was built
- Step 9: GitHub Actions starts a throwaway Postgres and runs `npm test` after lint and build. The database is not Neon.
- 9A: The server refuses edits to In Review and Exported reports. A firefighter can unlock In Review. Only an admin can unlock Exported. A second save is refused with the approved message. `NerisReportChange` stores who, when, the report, and field names only. History stays forever and is shown inside the report. Delete requires an unlock and an admin. Saving the NERIS Entity ID updates `Tenant.nerisEntityId`.
- 9B: Logo (500 KB), workflow states, submenu visibility, and submenu cards are stored in `DepartmentDetails.payloadJson.sharedDepartmentSettings`. Incident list layout and sidebar width stay on each computer. Admin and demo accounts were not deleted. `NODE_ENV=production` is in the release checklist and was not set on Render.

## Verification
- `npm test`: pass, including the new lock, history, entity ID, and shared-settings checks, against local database `fu_session_test` only.
- `npm run lint`: pass
- `npm run build`: pass (existing chunk-size warning only)
- The live app was not clicked. This environment has no `.env.server`, so the screens were not opened.
- The first GitHub run stopped at install: `.npmrc` has `engine-strict=true`, and `@prisma/streams-local` (pulled in by Prisma's unused local-database helper) declares Node 22. `--ignore-engines` does not override that file. CI stays on Node 20.19 and installs with `npm ci --engine-strict=false`. The app does not load that helper.

## Not done
- Do not touch staging, production, Neon, or Render.
- Do not merge until Session, RolePermission, AccountAuditLog, and NerisReportChange are applied on staging with a fresh backup.
- Still open: Fire Recovery Welcome Message email; Step 15 Reporting tab changes.
