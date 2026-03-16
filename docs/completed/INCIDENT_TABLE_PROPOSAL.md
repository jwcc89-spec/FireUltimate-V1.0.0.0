# Incident Table Proposal (Step 1)

**Branch:** `submenu/neris-golive-cifpd`  
**Purpose:** Prisma schema and migration for persisting incidents via API. **Approved;** schema and migration have been added (Step 2: you run the migration when your DB is available).

---

## 1. Naming (per plan)

- **incident_id** — Server-generated primary key (Prisma `id` with `cuid()`). This will be the main key in the app (top left, URLs, list).
- **incident_number** — User-generated, optional. Your/CAD reference; sent to NERIS as `incident_internal_id`. **Must remain available.**
- **Incident NERIS ID** — Not stored in this table; it lives in NERIS export history and NERIS draft form state. No change.

---

## 2. Proposed Prisma model

Add the following model to `prisma/schema.prisma` (no other models or auth changed):

```prisma
model Incident {
  id              String    @id @default(cuid())
  tenantId        String
  incidentNumber  String?   // user-generated (optional); for records and NERIS incident_internal_id
  dispatchNumber  String?   // user-generated (optional); dispatch_internal_id
  incidentType    String    @default("")
  priority        String    @default("")
  address         String    @default("")
  stillDistrict   String    @default("")
  assignedUnits   String    @default("")   // comma-separated or similar
  reportedBy      String?
  callbackNumber  String?
  dispatchNotes   String?   // plain text or JSON string; app normalizes as needed
  currentState    String    @default("Draft")
  receivedAt      String    @default("")
  dispatchInfo    String    @default("")
  apparatusJson   Json?     // RespondingApparatus[]; optional for list/detail
  mapReference    String?
  deletedAt       DateTime?
  deletedBy       String?
  deletedReason   String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, deletedAt])
}
```

And on the existing **Tenant** model, add the relation:

```prisma
model Tenant {
  // ... existing fields ...
  departments DepartmentDetails[]
  incidents   Incident[]   // add this line
}
```

---

## 3. Field mapping (app today → DB)

| App / UI field           | DB column       | Notes |
|--------------------------|-----------------|--------|
| callNumber (current key) | **id**          | Replaced by server `id` (cuid) as incident_id. API will return `id` so the app can use it in top left and URLs. |
| incident_internal_id / incidentNumber | **incidentNumber** | User’s optional incident number. |
| dispatch_internal_id / dispatchNumber | **dispatchNumber** | User’s optional dispatch number. |
| incidentType             | incidentType    | |
| priority                 | priority        | |
| address                  | address         | |
| stillDistrict            | stillDistrict   | |
| assignedUnits            | assignedUnits   | |
| reportedBy               | reportedBy      | |
| callbackNumber           | callbackNumber  | |
| dispatchNotes            | dispatchNotes   | String; app can store JSON or plain text. |
| currentState             | currentState    | |
| receivedAt               | receivedAt      | Kept as string for now to match app. |
| dispatchInfo             | dispatchInfo    | |
| apparatus (array)        | apparatusJson   | JSON for RespondingApparatus[]. |
| mapReference             | mapReference    | |
| lastUpdated              | updatedAt       | Server-maintained. |
| deletedAt / deletedBy / deletedReason | deletedAt, deletedBy, deletedReason | Soft delete. |

---

## 4. Migration (what the agent will add after approval)

- **One migration** (e.g. `add_incident_table` or `20260312000000_add_incident_table`) that:
  - Creates the `Incident` table with the columns above.
  - Adds the foreign key and indexes.
  - Does **not** change `User`, `Tenant`, `DepartmentDetails`, or auth.

---

## 5. What does **not** change in this step

- No changes to authentication or authorization.
- No changes to `DepartmentDetails` or `payloadJson`.
- No new API routes yet (Step 3).
- No frontend changes (Step 4). This is schema + migration only.

---

## 6. After you approve

Once you say **“approved”** (or approve with small changes):

1. **Schema:** The `Incident` model and `Tenant.incidents` relation are in `prisma/schema.prisma`.
2. **Migration file:** Created at `prisma/migrations/20260312180000_add_incident_table/migration.sql`.
3. **Prisma client:** `npx prisma generate` has been run so the client includes the `Incident` model.

---

## 7. What you run (Step 2)

When your database is available (e.g. `DATABASE_URL` in `.env.server`), run from the project root:

```bash
node -e "require('dotenv').config({ path: '.env.server' }); require('child_process').execSync('npx prisma migrate dev --name add_incident_table', { stdio: 'inherit', env: process.env });"
```

Or if `DATABASE_URL` is in `.env`, plain `npx prisma migrate dev --name add_incident_table` is enough.

**Success:** You see "Applied migration..." or "Database is already in sync" with no red errors. The `Incident` table will exist.

**If it fails:** Copy the full error and share it so we can fix the migration or connection.

**Staging:** If cifpdil.staging (and staging in general) use the same Neon DB as in `.env.server`, the migration you ran already applied to that DB; the Incident table is there. No extra step for staging. If staging used a different DB, you’d run the migration against that DB (e.g. `prisma migrate deploy` in deploy or manually).
