# Session note — Steps 9A and 9B approved, not built

Date: 2026-10-30 (America/Chicago)

## What the user decided
- NERIS: departments do not log in. One vendor key stays on the server. Each department exports only under the NERIS Entity ID an admin sets in Admin Functions. Export must pull that saved ID.
- 9A-1: the server refuses edits to In Review and Exported reports.
- 9A-2 (corrected 11:29 AM CDT): a Draft can be edited by anyone who can edit reports. Anyone who can edit reports can unlock an In Review report that has not been exported. Only an admin can unlock an Exported report.
- 9A-3: conflict warning approved, using the existing last-saved time. Message: "Someone else saved this report while you were editing. Reload to see their changes before saving again."
- 9A-4: new add-only history list. Store who, when, which report, and which field names changed. Do not store old and new text. Keep forever. Show it inside that report. No department-wide log in this step.
- 9A-5: the report must be unlocked before delete. Only an admin can delete.
- 9B-1: keep the admin and demo accounts. Do not delete them.
- 9B-2: set NODE_ENV=production on both Render services during a planned release only.
- 9B-3: move logo (500 KB limit), dispatch workflow states, submenu visibility, and submenu cards to the server. Incident list layout and sidebar width stay on each computer. Shift trades wait.

## Finding to fix in 9A
- The NERIS Entity ID box is saved on the server in department settings, and only an admin can save it (`neris.settings`).
- Export uses `Tenant.nerisEntityId`. The first save can copy the box onto that field. A later change of the box does not update it, so export can keep the old ID.

## Not done
- No app code in this note. 9A and 9B are not built.
- Do not touch staging, production, Neon, or Render.
- Step 9 release checklist approved and saved as `docs/procedures/RELEASE_CHECKLIST.md`. The automatic GitHub test run is not built yet.
- The live plan canvas had not been rewritten since Step 5. It was republished from the repo copy on October 30.
