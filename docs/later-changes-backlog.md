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
- [Later][P3] Optimize frontend bundle size and chunking strategy after acceptance gates.

---

## UI Conventions

- [Done][P3] Demo-only helper text pattern: gate by tenant context (`/api/tenant/context`, demo-like slug) and style helper text in blue using `.demo-helper-text`.

---

## Done (history)

- (Move completed backlog items here with date/commit when finished.)
