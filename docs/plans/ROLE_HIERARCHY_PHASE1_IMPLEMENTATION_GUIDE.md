# Role hierarchy (Phase 1) — implementation guide (beginner-friendly)

## What we’re building (Phase 1)

Make “admin-only” mean **admin level and higher**, so **superadmin always inherits admin** (and any future roles can be inserted into the hierarchy).

This phase focuses on:

- A shared helper like `hasAtLeastRole(currentRole, "admin")`
- Replacing fragile string checks like `role === "admin"` with threshold checks

**Not included yet (later):**

- Tenant-admin UI for granting/revoking capabilities (“named permissions”)
- Fine-grained per-field visibility/editability editor

---

## Constraints (non-negotiable)

- **Tenant isolation:** no cross-tenant data mixing.
- **Data integrity:** do not change Prisma schema/migrations/auth logic unless explicitly approved.
- **Small batches:** implement in small phases and verify after each phase.

---

## Acceptance criteria

- When logged in as **superadmin**, you can see/do everything an **admin** can (unless explicitly marked “superadmin-only”).
- The codebase no longer relies on `role === "admin"` for “admin-and-up” behavior.
- New role types can be added later and placed into the ordering without rewriting all checks.

---

## How “role hierarchy” works (the model)

- Each user has a **role key** (string), e.g. `user`, `subadmin`, `admin`, `superadmin`.
- Roles have a **numeric level** (rank). Higher number = higher privilege.
- A helper compares levels:
  `hasAtLeastRole(currentRoleKey, minimumRoleKey)` ⇒ `level(currentRoleKey) >= level(minimumRoleKey)`

---

## Phased plan (safe, small waves)

### Phase 0 — Inventory (no behavior changes)

**Goal:** find all places where role gating exists so we don’t miss anything.

**Agent tasks**

- Search for:
  - `role === "admin"` / `role !== "admin"`
  - `adminOnly` flags (menus/routes)
  - any server-side “admin” enforcement (if present)
- Make a checklist of affected files.

**User tests:** none (no code changes).

---

### Phase 1 — Add shared helpers (minimal surface area)

**Goal:** introduce one shared module for role comparisons, without changing UI behavior yet.

**Agent tasks**

- Add a helper module in `src/`:
  - `roleLevels` default mapping (user/subadmin/admin/superadmin)
  - `getRoleLevel(roleKey)`
  - `hasAtLeastRole(roleKey, minimumRoleKey)`
  - `isAdminOrHigher(roleKey)` convenience wrapper
- Keep existing code working (fallback to “user” on unknown role keys).

**User tests**

- None required yet (should not change UI behavior).

**Verification**

- `npm run lint`
- `npm run build`

---

### Phase 2 — Fix the known bug first (NERIS buttons)

**Goal:** ensure NERIS admin-only buttons appear for **admin and superadmin**.

**Agent tasks**

- Update `src/pages/NerisReportFormPage.tsx`:
  - replace `role === "admin"` with `isAdminOrHigher(role)`
  - keep any “superadmin-only” logic separate (if any)

**User test steps (staging)**

1. Log into **staging** as **superadmin**.
2. Open **Reporting → NERIS → (any incident)**.
3. Confirm you now see:
  - Import
  - Get Incident (Test)
  - CAD notes
  - Print
  - Export
  - Unlock (when locked)

**Verification**

- `npm run lint`
- `npm run build`

---

### Phase 3 — Fix global gating (menus + routes)

**Goal:** anywhere the UI treats “admin-only” as `role === "admin"` should become “admin and up”.

**Agent tasks**

- Update the “admin-only route” check in `src/App.tsx` (and any helpers it uses) so:
  - admin-only pages are accessible to admin + superadmin
- Update menu visibility logic (if it gates Admin Functions).

**User test steps (staging)**

1. Log into staging as superadmin.
2. Confirm Admin Functions items are visible and navigable.
3. Confirm a normal user still cannot access admin-only pages.

**Verification**

- `npm run lint`
- `npm run build`

---

### Phase 4 — Prepare for tenant-configurable ordering (design stub only)

**Goal:** keep Phase 1 shippable while preparing for Option B later.

**Agent tasks**

- Add a single “source of truth” function where role levels come from, so later we can swap in tenant-configured levels without rewriting all call sites.
  - (Example) `getEffectiveRoleLevelsForTenant()` with a default fallback.
- Do not introduce DB/schema changes in this phase unless explicitly approved.

**User tests**

- None required beyond regression checks.

---

## Handoff checklist (for next agent)

- Confirm current branch (`submenu/neris-golive-cifpd` for staging).
- Ensure staging deploy includes latest commits.
- Run `npm run lint` and `npm run build` after each phase.
- Document any remaining role checks that still use direct string compares.

---

## Now vs Later

- **Now (Phase 1–3):** implement hierarchy helper + replace admin checks with “admin and up”.
- **Later:** tenant UI to configure role ordering and capabilities (see `docs/plans/TENANT_ROLES_AND_PERMISSIONS_PLAN.md`).

