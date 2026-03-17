# Tenant-configurable roles + permissions (long-term plan)

## Goal
Support a **tenant-defined role hierarchy** (extensible beyond user/admin/superadmin) and a **capability-based permission system** so tenant admins can grant access to features without requiring per-field UI policy editing.

This plan intentionally avoids “click any field to set visibility/editability” across the whole UI because the app is still under heavy construction and field coverage would be brittle and easy to miss.

---

## Terms

- **Role key**: stable internal id for a role (examples: `user`, `secretary`, `subadmin`, `admin`, `superadmin`).
- **Role hierarchy / ordering**: a tenant-specific ordering of role keys (higher roles inherit lower roles).
- **Capability / permission**: named permission string (example: `neris.export`, `admin.functions.access`).
- **Inheritance requirement**: if something is allowed for role X, it must also be allowed for any higher role.

---

## Requirements (agreed)

### 1) Tenant-defined role hierarchy (ordering)

- **Default minimum roles** must exist for every tenant:
  - `user < subadmin < admin < superadmin`
- Tenants may add roles later (example):
  - `user < secretary < subadmin < admin < superadmin`
- All gating must be expressed as **“minimum role required”** (threshold) so new roles automatically “follow suit.”

### 2) Lockout + safety

At minimum:

- Each tenant must always have:
  - **at least 1 admin**
  - **at least 1 superadmin**
- Role/profile management constraints:
  - an **admin cannot delete a superadmin**
  - a **subadmin cannot change or delete** profiles for other subadmins or higher

### 3) Consistency across tenants

- Tenant onboarding will explicitly explain role meanings and expected usage.
- The platform should not assume a single global “user type ordering” beyond the default bootstrap.

---

## Recommended implementation approach (capability-based)

### Why capability-based vs per-field editor

Per-field UI gating (“click every field and decide visible/editable per role”) is expensive and error-prone while the app is still being built. Capability-based permissions give strong control with lower risk:

- easy to audit (“who can export to NERIS?”)
- easy to enforce on the server for sensitive actions
- easy to extend over time without missing fields

### Capability examples (starter set)

- **Admin access**
  - `admin.functions.access`
  - `admin.users.manage`
- **NERIS**
  - `neris.validate`
  - `neris.export`
  - `neris.unlock`
  - `neris.getIncidentTest`
- **Incidents**
  - `incidents.create`
  - `incidents.edit`
  - `incidents.delete`

---

## Enforcement model (must-have)

### Shared helpers (single source of truth)

- Role checks:
  - `hasAtLeastRole(userRoleKey, minimumRoleKey, tenantRoleConfig)`
- Capability checks:
  - `hasPermission(userRoleKey, permissionKey, tenantPolicy)`

### Where to enforce

- **Frontend**: hide/disable UI affordances based on permissions (UX).
- **Backend**: enforce on sensitive endpoints (security). UI-only hiding is not sufficient.

---

## Admin UI location (requested)

**Admin Functions → Department Details → Department Access → User Type**

Planned UI:

- **Role ordering editor**
  - add role (key + label)
  - place role in hierarchy (level/order)
  - guardrails to prevent lockout
- **Permissions editor**
  - grant/revoke capabilities per role
  - show “effective permissions” including inherited permissions

---

## Bootstrap + migration strategy

- New tenants:
  - seed default roles and default role→capability grants
- Existing tenants:
  - initialize default role ordering from current known roles
  - map existing users to the closest matching role key
  - avoid breaking existing access during rollout

---

## Phased rollout (recommended)

### Phase A (short-term): Fix inheritance everywhere

Replace ad-hoc checks like `role === "admin"` with a threshold check:

- “admin-and-up” must include superadmin
- keep superadmin-only exceptions explicitly labeled

### Phase B: Tenant role ordering

- Persist per-tenant role ordering/levels (seed defaults)
- Use tenant ordering for all threshold checks (“subadmin and up”, “admin and up”)

### Phase C: Named capabilities

- Define a small initial capability list
- Add tenant-grant UI + backend enforcement
- Migrate key features first (Admin Functions access, NERIS export/unlock)

### Phase D: Expand capabilities iteratively

- Add new capabilities as new features ship
- Avoid per-field policies unless a specific feature requires it

---

## Now vs Later

- **Now**: implement global role inheritance correctly (admin-and-up includes superadmin) and document the rule to avoid regressions.
- **Later**: tenant-configurable role ordering + capability grants UI, with server-side enforcement.

