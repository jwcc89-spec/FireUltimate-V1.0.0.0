# Session Note - Phase A safety and NERIS queue gating

## Date
- 2026-03-10

## Branch
- `submenu/neris-golive-cifpd`

## Work completed
- Verified Phase A production safety checks:
  - `GET /api/neris/health` on `cifpdil.fireultimate.app` shows:
    - `baseUrl: https://api.neris.fsri.org/v1`
    - `hasClientCredentials: true`
    - `hasDefaultEntityId: false` (fail-closed posture)
  - `GET /api/tenant/context` on `cifpdil.fireultimate.app` resolves tenant slug `cifpdil`.
  - `GET /api/neris/debug/entities` on `cifpdil.fireultimate.app` does not yet include `FD17075450`.
- Verified staging host routing:
  - `GET /api/tenant/context` on `cifpdil.staging.fireultimate.app` resolves tenant slug `cifpdil`.
- Implemented UI safety cleanup in `src/App.tsx`:
  - NERIS sample queue/export fixture rows are now shown only for demo tenants.
  - Non-demo/live tenants see explicit empty-state guidance instead of sample incidents.
- Ran `npm run lint` after changes -> pass.

## Observed staging environment state
- `GET /api/neris/health` on `cifpdil.staging.fireultimate.app` currently shows:
  - `baseUrl: https://api-test.neris.fsri.org/v1`
  - `hasClientCredentials: false`
  - `hasDefaultEntityId: true`
- This indicates staging env values still need to be synchronized for current testing intent.

## User-action items
1. In Render staging service (`fireultimate-api-staging`), set/verify:
   - `NERIS_BASE_URL` (normally `https://api-test.neris.fsri.org/v1` for staging)
   - `NERIS_CLIENT_ID`
   - `NERIS_CLIENT_SECRET`
   - `NERIS_GRANT_TYPE=client_credentials`
2. Remove/blank `NERIS_ENTITY_ID` in staging if running fail-closed behavior tests.
3. Re-run staging health check and confirm expected fields.

## Reminder
- If staging `NERIS_BASE_URL` is temporarily switched away from `api-test` for a controlled production-path check, switch it back before session closeout.

## Next implementation step
- Continue Phase B: tenant-scoped `NERIS_ENTITY_ID` resolution with explicit export denial when tenant entity is missing.
