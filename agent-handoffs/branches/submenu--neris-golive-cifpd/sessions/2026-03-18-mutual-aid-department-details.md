# 2026-03-18 — Mutual aid departments (Department Details + NERIS form)

## Shipped
- **Server:** `GET /api/neris/entities` (cached nationwide list, `page_size` 100), `POST /api/admin/neris/entities/refresh`.
- **Department Details:** Mutual Aid editor loads from `/api/neris/entities`; DD-M by state; **Add local** (no NERIS ID, not for FD export); **Reload directory** / **Refresh from NERIS** (platform admin key modal).
- **Payload:** `mutualAidDepartmentSelections` (+ legacy `selectedMutualAidIds` derived from NERIS entries).
- **NERIS form:** If tenant has ≥1 configured NERIS mutual aid dept, **Aid department name(s)** is restricted to that list; invalid saved value auto-cleared. If none configured, full directory from `/api/neris/entities`.

## Next
- Optional: block NERIS export when FD aid selected is not in allowlist (defense in depth).
- Tenant admin refresh without platform key (e.g. superadmin session route) if desired.
