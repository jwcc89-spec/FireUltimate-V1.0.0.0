# Go-Live Checkpoint and Next Steps (Pick Up Here)

Last updated: 2026-03-11
Branch: `submenu/neris-golive-cifpd`

Use this file as the single resume point if session ends.

## 1) Current verified status

### Staging (`fireultimate-api-staging`)
- `GET /api/tenant/context` -> OK (`cifpdil` resolved).
- `GET /api/neris/health` -> OK, `baseUrl=https://api-test.neris.fsri.org/v1`, `hasClientCredentials=true`, `hasTenantEntityId=false`.
- `GET /api/neris/debug/entity-check?nerisId=FD17075450` -> OK for:
  - `/entity?neris_id=FD17075450`
  - `/entity/FD17075450`
- `/account/enrollment/{client_id}` may return 403 in test env; this is not currently blocking when entity checks pass.

### Production (`main` deploy path)
- `GET /api/tenant/context` -> OK.
- `GET /api/neris/health` -> OK, `baseUrl=https://api.neris.fsri.org/v1`.
- `GET /api/neris/debug/entity-check?...` -> **missing route** (`Cannot GET`) because production is not yet on branch changes.

## 2) Critical go-live blocker (mandatory)

Incident Detail page must have editable incident input boxes for end users.

Current state:
- Create Incident row creation works.
- Queue row linkage into NERIS form path is fixed in branch code.
- Incident Detail page remains mostly display-only and needs editable inputs.

## 3) Exact next sequence (do in order)

1. Confirm with user the exact editable field set and save behavior for Incident Detail page.
2. Implement Incident Detail editable form (small batch), including save/persist behavior.
3. Run `npm run lint`.
4. Validate staging UX:
   - Create Incident -> open Incident Detail -> edit fields -> save -> refresh persists.
   - Click incident in Reporting | NERIS -> form opens and is fillable.
5. Run staging validate/export proof for one incident.
6. If staging passes, open PR branch -> `main`.
7. Merge PR and deploy production.
8. Re-run production endpoint checks and perform first controlled production export.

## 4) Commands for quick re-check

```bash
curl -sS "https://cifpdil.staging.fireultimate.app/api/tenant/context"
curl -sS "https://cifpdil.staging.fireultimate.app/api/neris/health"
curl -sS "https://cifpdil.staging.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450"
curl -sS "https://cifpdil.fireultimate.app/api/tenant/context"
curl -sS "https://cifpdil.fireultimate.app/api/neris/health"
curl -sS "https://cifpdil.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450"
```

## 5) Notes to avoid confusion

- `cifpdil` is your tenant slug (internal app naming).
- `NERIS_CLIENT_ID` is assigned by NERIS for OAuth; it is not your tenant slug.
- Keep staging on `api-test` as default safety path.
- Production route availability follows `main` deployment, not branch-only commits.
