# NERIS + Render Source of Truth (CIFPDIL)

Purpose: remove ambiguity. This file defines exactly what each NERIS value means, which Render service owns which config, and the required staging-first rollout order.

## 1) Definitions (no ambiguity)

- `cifpdil`:
  - This is your Fire Ultimate tenant slug (a name you chose for the tenant/domain).
  - It is not assigned by NERIS.
- `NERIS_CLIENT_ID`:
  - This is assigned by NERIS for OAuth authentication.
  - It identifies your NERIS integration client, not your Fire Ultimate tenant slug.
  - For this rollout, NERIS support confirmed client id `3f104b60-f7cf-437e-b79c-868fe6489f31` is active for entity `FD17075450`.
- `NERIS_ENTITY_ID`:
  - NERIS department/entity identifier (for this rollout: `FD17075450`).
- `NERIS_BASE_URL`:
  - NERIS API environment URL used by the backend proxy.
  - Test: `https://api-test.neris.fsri.org/v1`
  - Production: `https://api.neris.fsri.org/v1`

## 2) Render services (authoritative)

- Staging API service: `fireultimate-api-staging`
- Production API service: `fireultimate-api-prod` (or your equivalent production API service name)

## 3) Environment policy by stage

### Staging (required first)

Default policy:
- Keep `NERIS_BASE_URL=https://api-test.neris.fsri.org/v1`
- Use staging/test NERIS client credentials
- Verify app behavior and schema/mapping safely

Optional temporary production-path smoke test in staging:
- You may temporarily set staging `NERIS_BASE_URL=https://api.neris.fsri.org/v1` only if:
  1) You explicitly want a production endpoint connectivity check before prod rollout.
  2) Staging credentials are switched to the production NERIS client for that test.
  3) You switch staging back to `api-test` after the smoke test.

Important:
- If staging points to production URL with test credentials, token/auth checks will fail.
- If staging points to production URL with production credentials, staging exports can affect production NERIS data if you submit real exports. Use caution.

### Production (go-live)

- Set `NERIS_BASE_URL=https://api.neris.fsri.org/v1`
- Set production NERIS client credentials assigned by NERIS.
- Run controlled first export only after staging checks pass.

## 4) Correct verification endpoints

Do not treat `GET /entity` as a canonical authorization list.

Use these checks:
- `GET /api/neris/debug/entity-check?nerisId=FD17075450`
  - checks `GET /entity?neris_id=...`
  - checks `GET /entity/{neris_id}`
  - checks `GET /account/enrollment/{client_id}`
- `GET /api/neris/health`
- `GET /api/tenant/context`

`GET /api/neris/debug/entities` is informational directory output only.

## 5) Required rollout order (current phase)

1. Staging code deploy complete on `fireultimate-api-staging`.
2. Staging DB migration applied (`npx prisma migrate deploy`).
3. Staging endpoint checks pass (`tenant/context`, `neris/health`, `debug/entity-check`).
4. Staging validate/export proof pass.
5. Production deploy + migration.
6. Production endpoint checks pass.
7. Controlled first production export.

## 6) Current known status snapshot

From latest checks:
- Staging currently errors on tenant resolution with DB column mismatch -> migration not fully aligned yet.
- Production currently serves tenant context/health but does not yet expose `/api/neris/debug/entity-check` -> production API is behind latest branch code.
- Production `/api/neris/debug/entities` currently returns unrelated entity IDs, indicating production NERIS credentials are not yet set to the intended CIFPDIL integration client context.

## 7) Beginner-safe rule

If unsure:
- Do all risky checks in staging first.
- Keep staging on `api-test` by default.
- Promote to production only after staging is green.
