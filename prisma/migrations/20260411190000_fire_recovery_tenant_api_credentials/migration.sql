-- Fire Recovery optional per-tenant API login (JWT). When both are set, server uses these instead of FIRE_RECOVERY_API_* env.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "fireRecoveryApiUsername" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "fireRecoveryApiPassword" TEXT;
