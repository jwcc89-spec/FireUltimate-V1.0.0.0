# Procedures and runbooks (active)

Use these when performing setup, onboarding, or verification.

| Doc | Purpose |
|-----|--------|
| **GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md** | Resume point for go-live; pre-export verification; NERIS notes. |
| **STAGING_AND_DEPLOYMENT.md** | Staging branch (`submenu/neris-golive-cifpd`), Render, latest commit; “push” vs “redeploy on Render” explained. |
| **STAGING_VS_PRODUCTION_DATA.md** | Why incidents/export history from staging don't show on production (separate databases). |
| **TENANT_ONBOARDING_CHECKLIST.md** | Checklist per new tenant (intake, DB, Render env, DNS, NERIS, first export). |
| **NEON_PRODUCTION_PROJECT_SETUP.md** | Step-by-step: create Neon production project, migrations, seed, domain, Render. |
| **EMAIL_AND_CAD_SETUP.md** | Email + CAD: Google Workspace (jeremy@), CAD address (cifpdil@), Cloudflare Worker, test, troubleshooting. Single guide for email and CAD ingest. |
| **NERIS_CROSS_BROWSER_FINDINGS.md** | Why NERIS report and export history don’t show in another browser (localStorage-only); fix direction and code refs. **Next priority after CAD email.** |
| **BACKLOG_INCIDENTS_NERIS_UX.md** | Incidents and NERIS form UX items to prioritize (Reported By, dispatch notes, military time, Aid departments, etc.). **Keep this:** PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED is the master list; BACKLOG has the full implementation detail (issue, desired, options) for those items. |
| **LATER_TASKS_VALIDATE_EXPORT_ROLES_AND_ADMIN_VISIBILITY.md** | Validate for all / Export admin-only; super admin; admin show/hide mode. |
| **CREATE_SUPERADMIN_PRODUCTION.md** | Step-by-step: create a Super Admin user in production (cifpdil.fireultimate.app) when the option is hidden in the UI. |
| **STAGING_TEST_STEPS_BEGINNER.md** | Staging test steps (beginner-friendly). |
| **STAGING_TEST_CHECKLIST_DETAILED.md** | Detailed staging checklist. |
| **NERIS_RENDER_SOURCE_OF_TRUTH.md** | NERIS and Render env as source of truth. |
| **NERIS_WAITING_AND_POST_SUPPORT_STEPS.md** | NERIS support and post-support steps. |
| **INCIDENT_API_EXAMPLES.md** | Example API requests for incidents. |
| **TENANTS_NERIS_AND_BRANCHES_EXPLAINED.md** | Tenants, NERIS, and branches overview. |
| **CROSS_BROWSER_AND_UX_NOTES.md** | Cross-browser and UX notes. |
| **CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md** | Planning: Incident Settings → Parsing Data; per-tenant parsing rules; auto-create incident from CAD email; apparatus match; dedupe; call sequencing. **After NERIS cross-browser Phase 2/3.** |
