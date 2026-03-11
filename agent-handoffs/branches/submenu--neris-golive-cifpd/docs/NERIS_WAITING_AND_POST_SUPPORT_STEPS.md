# NERIS Support Wait Plan (Now vs Later)

This checklist is split into what we can complete **now** while waiting on NERIS support, and what to complete **later** immediately after NERIS confirms entity authorization.

## NOW (while waiting on NERIS support)

1. Confirm branch and deployment target.
   - Verify work is on `submenu/neris-golive-cifpd`.
   - Confirm staging service points to this branch before validating.

2. Deploy current Phase B backend + queue updates to staging.
   - Deploy backend changes including tenant-scoped entity logic.
   - Ensure frontend incident queue/create-incident fix is included.

3. Apply database migration in staging.
   - Run migration that adds `Tenant.nerisEntityId`.
   - Confirm Prisma client is generated for the deployed build.

4. Validate tenant resolution and NERIS health endpoints.
   - Open `https://cifpdil.staging.fireultimate.app/api/tenant/context` and confirm tenant is `cifpdil`.
   - Open `https://cifpdil.staging.fireultimate.app/api/neris/health` and verify:
     - `baseUrl` is `https://api-test.neris.fsri.org/v1`
     - `hasClientCredentials` is `true`
     - `hasDefaultEntityId` is `false`
     - `hasTenantEntityId` reflects current tenant setup

5. Verify incident queue workflow end-to-end in staging UI.
   - Go to `Incidents / Mapping | Incidents`.
   - Click `Create Incident` and confirm a row is created/opened.
   - Go to `Reporting | NERIS` and confirm same incident appears in queue.

6. Set/confirm tenant entity source in Department Details.
   - Set CIFPDIL department NERIS entity value in Department Details payload fields used by backend mapping.
   - Save and recheck `/api/neris/health` for `hasTenantEntityId:true`.

7. Continue daily authorization check until support responds.
   - Run `https://cifpdil.staging.fireultimate.app/api/neris/debug/entities`.
   - Confirm whether `FD17075450` appears in `accessibleEntityIds`.

8. Keep one go-live candidate report prepared.
   - Complete required NERIS fields for one incident and save draft.
   - Do not force production export until authorization is confirmed.

## LATER (immediately after NERIS support confirms authorization)

1. Re-run authorization verification first.
   - Confirm `FD17075450` is present in `accessibleEntityIds` from `/api/neris/debug/entities`.

2. Execute staging validation + export test.
   - Validate report via `/api/neris/validate` flow in UI.
   - Export report from staging and confirm success response.
   - Capture resulting NERIS ID and status for record.

3. Perform production readiness checks.
   - Confirm production tenant context and health endpoint.
   - Confirm production env values are correct and no global entity fallback is active.
   - Confirm tenant-scoped entity resolution is active.

4. Run first controlled production export.
   - Submit one reviewed incident from `cifpdil.fireultimate.app`.
   - Verify response status and stored export record details.

5. Post-go-live stabilization checks.
   - Re-run `/api/neris/debug/incident` for exported NERIS ID.
   - Confirm retrieval matches submitted department/entity values.
   - Monitor logs for 24-48 hours for auth or entity mismatch errors.

6. Roll out onboarding pattern to next tenant.
   - Reuse tenant-specific entity approach (`Tenant.nerisEntityId`).
   - Never use cross-tenant fallback for NERIS entity IDs.

## Quick Rule

- **Now**: finish deploy/migration/integration readiness and daily authorization checks.
- **Later**: once NERIS confirms authorization, run staging export proof, then controlled production export and monitoring.
