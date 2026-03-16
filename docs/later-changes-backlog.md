# Later Changes Backlog (Menu/Submenu Organized)

Purpose: keep all deferred or future work in one place from this point forward, organized by menu/submenu so changes stay easy to find and prioritize.

## How to use this file
- Add new items under the relevant menu/submenu section.
- Keep each item short and action-focused.
- Update `Status` as work progresses:
  - `Later` = deferred/not started
  - `Planned` = approved for upcoming batch
  - `In Progress` = actively being implemented
  - `Done` = completed
- Move completed items to the `Done` section at the bottom for history.

## Priority keys
- `P1` high priority / unblocker
- `P2` medium priority
- `P3` low priority / polish

---

## Admin Functions -> Department Details

### Department Access
- [Later][P2] Replace prompt-style reset-password UX with an in-app modal/dialog flow.

### Security / Auth Hardening (cross-cutting but tracked under Admin)
- [Later][P1] Add auth rate-limiting and/or temporary lockout for repeated failed login attempts.
- [Later][P2] Add password reset/change audit logging (who, when, target user).

---

## Admin Functions -> Scheduler Settings

- [Later][P2] Revisit advanced scheduling model redesign (forward-only sync + optional historical backfill) in a controlled implementation pass.

---

## Admin Functions -> Personnel Management

- [Later][P2] Add search/filter enhancements for larger user/personnel datasets (optional debounce/highlight, persisted query).

---

## Platform / Deployment

- [Later][P2] Deploy frontend staging as a separate Render service (optional, when desired).
- [Later][P2] Add configurable tenant policy controls for demo-style tenants when business rules are finalized.
- [Later][P2] Add wildcard DNS `*.fireultimate.app` for faster tenant onboarding after live NERIS cutover is stable.
- [Later][P3] Evaluate Cloudflare proxied mode (orange cloud) and enable after validating API/NERIS flows with DNS-only baseline.
- [Later][P3] Optimize frontend bundle size and chunking strategy after acceptance gates.

---

## Login / Auth (general UI)

- [Later][P2] **Login screen:** Remove "Fire Department (optional)" field from main login form.
- [Later][P2] **Login screen:** Remove or simplify helper text on main login screen (e.g. "Credentials are validated against saved Users", brand-panel copy).
- [Later][P2] **Login screen:** Display tenant picture on login page; picture is uploaded in Admin Functions or Settings (ensure upload/store exists and is used on login).

---

## UI Conventions

- [Done][P3] Demo-only helper text pattern: gate by tenant context (`/api/tenant/context`, demo-like slug) and style helper text in blue using `.demo-helper-text`.
- [Later][P2] **"Scaffolded" → "Beta":** Change all "Scaffolded" wording to *Beta* (italicized blue text) app-wide (e.g. submenu cards, build-status labels).
- [Later][P2] **Beta sections – super admin only:** Beta submenus (e.g. Certifications) stay viewable and clickable only for **super admin** (for buildouts). For **admin and lower:** show label with "beta" to the right; do not allow click; do not open submenu. Same for the Certifications **card** on Personnel main menu: visible but not clickable for non–super-admin.

---

## Done (history)

- (Move completed backlog items here with date/commit when finished.)
