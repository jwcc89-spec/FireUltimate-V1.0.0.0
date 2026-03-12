# Data Model

This project uses a mixed data model:

1. **Core relational entities** stored in the database via Prisma
2. **Structured department configuration** stored in `DepartmentDetails.payloadJson`
3. **Schedule assignment data** stored in `ScheduleAssignments.assignmentsJson` (tenant-scoped by shift type and date)

This document helps developers and AI agents understand where data lives and how tenant isolation works. For UI-to-field mapping, see `docs/department-details-field-reference.md`.

---

## AI Guardrail

**Not all business objects have Prisma models.**

Before creating database logic, confirm whether the source of truth is:

1. **Prisma relational table**
2. **DepartmentDetails.payloadJson**
3. **API-generated data** (e.g. external NERIS API)

This prevents creating unnecessary tables.

---

## 1. Tenant

Represents a fire department/customer workspace.

**Key fields**

- `id` (cuid)
- `slug` (unique)
- `name`
- `status`
- `nerisEntityId` (optional; used for NERIS reporting)
- `createdAt`, `updatedAt`

**Notes**

- Every tenant is isolated from every other tenant.
- Valid `status` values (enforced by admin API): `sandbox`, `trial`, `active`, `suspended`, `archived`. Default in schema is `active`.

---

## 2. TenantDomain

Maps a hostname to a tenant for domain-based routing.

**Key fields**

- `id` (cuid)
- `tenantId`
- `hostname` (unique)
- `isPrimary`
- `createdAt`

**Notes**

- Used for host-based tenant resolution (request `Host` / `X-Forwarded-Host`). Localhost resolves to the `demo` tenant.
- A hostname may belong to only one tenant.

---

## 3. User

Login account for a tenant. Auth is stored only in this table, not in `DepartmentDetails.payloadJson`.

**Key fields**

- `id` (cuid)
- `tenantId`
- `username` (unique per tenant: `@@unique([tenantId, username])`)
- `passwordHash`
- `role`
- `createdAt`, `updatedAt`

**Notes**

- Passwords must be stored as bcrypt hashes.
- Roles in use: `admin`, `user`.

---

## 4. DepartmentDetails

One row per tenant. Holds department-level configuration and editor-managed collections in JSON.

**Key fields**

- `id` (cuid)
- `tenantId` (unique: one DepartmentDetails per tenant)
- `departmentName`
- `payloadJson` (JSON object; see below)
- `createdAt`, `updatedAt`

**Notes**

- Auth secrets must **never** be stored in `payloadJson`. Login and password hashes live in the `User` table only.
- The API strips `userRecords` from the payload on GET and does not require them on POST; user management is via `/api/users`.

---

## 5. ScheduleAssignments

Tenant-scoped schedule data keyed by shift type and date.

**Key fields**

- `id` (cuid)
- `tenantId`
- `shiftType`
- `dateKey`
- `assignmentsJson` (JSON: `assignments`, `overtimeSplit` and related structure)
- `createdAt`, `updatedAt`

**Notes**

- Unique per tenant + shift type + date: `@@unique([tenantId, shiftType, dateKey])`.
- Consumed by Personnel Schedule UI via `GET/POST /api/schedule-assignments`.

---

## 6. DepartmentDetails.payloadJson

`payloadJson` holds department-specific configuration and collections. Keys and shapes are defined by the frontend and API; below are the ones in current use.

**Scalar / single-value (examples)**

- `departmentName`, `departmentStreet`, `departmentCity`, `departmentState`, `departmentZipCode`
- `departmentTimeZone`, `mainContactName`, `mainContactPhone`, `secondaryContactName`, `secondaryContactPhone`
- `departmentLogoFileName`
- `schedulerEnabled`, `standardOvertimeSlot`
- `incidentsSetup` (incident setup config)
- `selectedMutualAidIds` (array of NERIS entity IDs)

**Collections (array keys)**

- `stationRecords` — stations
- `masterApparatusRecords` — apparatus (unitId, commonName, unitType, make, model, year, etc.)
- `schedulerApparatusRecords` — scheduler-specific apparatus (minPersonnel, personnelRequirements, station, etc.)
- `shiftInformationEntries` — shift definitions
- `schedulerPersonnelRecords` — personnel used for scheduling (name, shift, apparatusAssignment, station, userType, qualifications)
- `personnelQualifications` — array of strings (hierarchy for scheduling)
- `userTypeValues` — tenant-defined user types
- `additionalFields` — extra field definitions
- `kellyRotations` — Kelly rotation entries
- `uiPreferencesByUser` — per-user UI preferences (e.g. column widths)

**Server-maintained (do not overwrite blindly)**

- `userFullNames` — map of user id → display name (used with `User` table)
- `userTypeLabels` — map of user type value → label (used with `User` table)

**Important**

- This data is tenant-scoped and belongs only to the owning tenant.
- Do not store auth credentials or secrets in `payloadJson`.

---

## 7. Department configuration collections (payloadJson keys and shapes)

The following collections live inside `DepartmentDetails.payloadJson` under the keys listed. Field names match the current frontend/API usage.

### Stations (`stationRecords`)

- `name`, `address`, `city`, `state`, `phone`, `mobilePhone`

### Apparatus (`masterApparatusRecords`)

- `unitId`, `commonName`, `unitType`, `make`, `model`, `year` (and any other UI-defined fields)

### Scheduler apparatus (`schedulerApparatusRecords`)

- Scheduler-specific apparatus fields (e.g. `minimumPersonnel`, `personnelRequirements`, `station`)

### Personnel / scheduler personnel (`schedulerPersonnelRecords`)

- `name`
- `shift` (references shift information)
- `apparatusAssignment` (references apparatus)
- `station` (references stations)
- `userType` (references `userTypeValues`)
- `qualifications` (array; references `personnelQualifications`)

### Shift information (`shiftInformationEntries`)

- `shiftType`, `shiftDuration`, `recurrence`, `recurrenceCustomValue`, `location`

### User types (`userTypeValues`)

- Array of tenant-defined user type strings (e.g. "Career", "Volunteer"). Labels may be in `userTypeLabels` for display.

### Personnel qualifications (`personnelQualifications`)

- Array of strings; order can denote hierarchy for scheduling.

### Mutual aid departments (`selectedMutualAidIds`)

- Array of NERIS entity IDs. Full entity list may come from NERIS API; this stores the tenant’s selected IDs.

---

## 8. Tenant isolation rules

- All reads and writes for tenant-specific data must be scoped by `tenantId` (from `request.tenant.id` after host resolution).
- Tenant is resolved from the request host via `TenantDomain` (localhost → `demo` tenant).
- No tenant’s data may be mixed or reused for another tenant.
- The `demo` tenant is persistent unless explicitly reset.

---

## 9. Reporting / NERIS-related notes

- NERIS-related tenant configuration must resolve from tenant-scoped data (e.g. tenant’s `nerisEntityId`, department details, selected mutual aid).
- Do not fall back to global environment defaults for tenant traffic unless explicitly intended and documented.
- Tenant entity ID is stored on `Tenant.nerisEntityId`; department reporting metadata and options live in `DepartmentDetails.payloadJson` or derived from it.

---

## 10. Storage evolution notes

Some business/domain data currently lives in `DepartmentDetails.payloadJson` (and schedule data in `ScheduleAssignments.assignmentsJson`). Over time, some collections may be promoted to dedicated relational tables if needed for:

- search and filtering
- auditability
- scheduling logic
- reporting/export integrity

Agents must **not** migrate JSON-backed structures into new database tables without explicit approval and a documented migration plan.
