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

**Staging browser tests (2.1–2.5):** Passed 2026-03-12. See STAGING_TEST_STEPS_BEGINNER.md.

**Order:** Get incident data fully on the server and working **before** PR to main, so the department has a complete, functional system.

1. ~~Confirm with user the exact editable field set and save behavior for Incident Detail page.~~ (User confirmed 2.2 pass.)
2. ~~Validate staging UX~~ — Done (2.1–2.5 pass).
3. ~~**Run staging validate/export proof**~~ — **Passed 2026-03-13.** Export returned 201 Created; NERIS `neris_id`: `FD17075450|none|1771420482`, status SUBMITTED. `incident_number` sanitization (Test-_Export) accepted.
4. ~~**Complete Step 4 (Incident API in frontend)**~~ — **Done.** App loads list from GET /api/incidents on login; create/update/delete use POST/PATCH/DELETE; localStorage used as cache after API success.
5. **Then:** Open PR branch `submenu/neris-golive-cifpd` → `main` → merge and deploy production.
6. Re-run production endpoint checks (see §4 below).
7. Perform first controlled production export when ready.

## 4) Commands for quick re-check

```bash
curl -sS "https://cifpdil.staging.fireultimate.app/api/tenant/context"
curl -sS "https://cifpdil.staging.fireultimate.app/api/neris/health"
curl -sS "https://cifpdil.staging.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450"
curl -sS "https://cifpdil.fireultimate.app/api/tenant/context"
curl -sS "https://cifpdil.fireultimate.app/api/neris/health"
curl -sS "https://cifpdil.fireultimate.app/api/neris/debug/entity-check?nerisId=FD17075450"
```

## 5) NERIS incident_number (internal_id) format

NERIS returns **422 "Invalid internal_id format for incident"** if `base.incident_number` or `dispatch.incident_number` contain spaces or other disallowed characters. The proxy now **sanitizes** these values before sending: spaces → underscore, and only `A–Z a–z 0–9 _ -` are kept. So e.g. "Test- Export" is sent as "Test-_Export". Users can still type anything in the form; the payload sent to NERIS is normalized.

---

## 6) CAD dispatch via email (after incidents on server)

**Order:** Get incidents fully on the server (Step 4) and PR to main first; then CAD email ingest.  
**Guide:** See **CAD_EMAIL_INGEST_SETUP_GUIDE.md** in this folder — step-by-step: (1) set up email address and give to dispatch, (2) server monitors that inbox (IMAP or webhook), (3) you send test email from dispatch, (4) we parse and auto-fill incident fields.

---

## 7) Notes to avoid confusion

- `cifpdil` is your tenant slug (internal app naming).
- `NERIS_CLIENT_ID` is assigned by NERIS for OAuth; it is not your tenant slug.
- Keep staging on `api-test` as default safety path.
- Production route availability follows `main` deployment, not branch-only commits.
