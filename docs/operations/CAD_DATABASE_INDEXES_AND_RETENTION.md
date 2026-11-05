# CAD email — database indexes and retention (operations notes)

**Audience:** Developers and DB operators. **Not** a substitute for Prisma migrations approved by the project owner.

---

## Indexes (already in migrations)

The following indexes are **already created** by existing Prisma migrations (do not re-apply blindly):

| Table | Index | Purpose |
|-------|--------|---------|
| `CadEmailIngest` | `tenantId` | Filter emails per tenant |
| `CadEmailIngest` | `createdAt` | Sort newest-first |
| `CadParsingSettings` | `tenantId` (unique) | One settings row per tenant |

If you add **new** query patterns (e.g. heavy reporting by `fromAddress`), consider a **new migration** after explicit approval.

---

## Retention (future product work)

**Stakeholder direction:** Optional automatic deletion based on **age** (days) and/or **row count**, configured by an admin. That requires:

- Persisted settings (schema change — **needs approval**)
- A **scheduled job** (cron, worker, or host-specific scheduler)
- UX in admin setup

Until that ships, retention is **manual** (Neon console, SQL) or **documentation-only** limits. Do not run destructive SQL on production without a backup.

---

## Suggested SQL for manual cleanup (use with care)

Only when you intentionally delete old rows **after backup**:

```sql
-- Example: delete rows older than 90 days (review tenant scope before running)
-- DELETE FROM "CadEmailIngest" WHERE "createdAt" < NOW() - INTERVAL '90 days';
```

Commented out by default — uncomment and adjust only after review.

---

*Batch I — operational notes. Retention automation is backlog / post–Batch I.*
