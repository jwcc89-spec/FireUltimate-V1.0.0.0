# 2026-03-18 — Mutual aid departments (Department Details + NERIS form)

## Shipped
- **Server:** `GET /api/neris/entities` (cached nationwide list, `page_size` 100 max per NERIS API), `POST /api/admin/neris/entities/refresh`.
- **Department Details:** Mutual Aid editor loads from `/api/neris/entities`; DD-M by state; **Add local** (no NERIS ID); **Reload directory** / **Refresh from NERIS** (platform admin key modal).
- **Payload:** `mutualAidDepartmentSelections` (+ legacy `selectedMutualAidIds` derived from NERIS entries).
- **NERIS form:** When Department Details has **≥1** mutual aid row (NERIS **or** local), **Aid department name(s)** lists **only** those rows; otherwise full directory from `/api/neris/entities`. Invalid saved FD value auto-cleared when not in list.
- **CORE labels:** Dropdown shows **department name** (and state for locals); **value** for NERIS rows remains FD/FM ID for export.
- **Local-only in CORE:** Local DD-M entries appear in the aid dropdown; stored as `LOCAL_AID_OPT:*` — **not** sent as `department_neris_id` on export.
- **FIRE requiredness:** FIRE module fields not required when aid = Yes and direction = **Given**.
- **Times:** Core Incident Onset + Incident Times module use **HH:MM:SS** (24h).

## Docs
- `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md` — 11.3, 11.3a–d + session summary.
- `docs/procedures/BACKLOG_INCIDENTS_NERIS_UX.md` — status notes on aid list, FIRE rule, 24h partial.

## Next (open)
- Optional: block NERIS export when FD aid selected is not in allowlist (defense in depth).
- Tenant admin refresh without platform key (e.g. superadmin session route) if desired.
- **BACKLOG #10:** Exclude or grey out tenant’s own FD in aid list (UI).
- Commit/push **local-only CORE** change if not yet on remote (`mutualAidAllowlist.ts` + `NerisReportFormPage.tsx`).
