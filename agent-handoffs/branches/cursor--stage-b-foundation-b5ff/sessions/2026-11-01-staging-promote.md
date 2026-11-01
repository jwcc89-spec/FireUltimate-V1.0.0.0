# Session note — 2026-11-01 staging promote

Audience: the next agent. One note for this working session.

## What is true now
- Stage B, security fixes 1–14, and the Allowed Senders screen are on staging.
- Staging branch `submenu/neris-golive-cifpd` tip for the running program is `d4bbaee`.
- Pull request 31 is merged. Do not merge it again. Do not merge to `main`.
- This practice branch (`cursor/stage-b-foundation-b5ff`) is ahead of `d4bbaee` by documentation commits only. Do not push those onto the staging branch. That push redeploys Render.
- Production is the pre-Stage-B program plus the Fix 15 one-line hotfix (PR #33). Do not start the production release unless the user asks.

## What the operator did (America/Chicago)
1. About 1:07 p.m. Created Neon branch `backup-2026-11-01-before-stage-b` in project `fireultimate-staging`. Incident count 22. Leave it alone.
2. About 1:14 p.m. Saved Crescent sender on the live staging branch named `production`, tenant slug `cifpdil`. Row id `allow-cifpdil-dispatch-20261101`, pattern `dispatch@co.iroquois.il.us`, type `exact_email`, enabled. Do not delete it. CAD mailbox (the To address) is `cifpdil@cad.fireultimate.app`.
3. About 1:19 p.m. Confirmed tables `Session`, `RolePermission`, `AccountAuditLog`, and `NerisReportChange` after `prisma migrate deploy` against the live staging database only.
4. About 1:33 p.m. Approved the promote. PR 31 fast-forwarded into `submenu/neris-golive-cifpd` at `d4bbaee`.
5. First Render build of `d4bbaee` failed: `EBADENGINE` for unused `@prisma/streams-local@0.1.11` (wants Node 22; Render is Node 20.19.0; `.npmrc` has `engine-strict=true`). The operator set the staging build command to `npm ci --engine-strict=false && npm run build` on `fireultimate-api-staging` only. That later build succeeded. Do not upgrade Node or Prisma. Do not change `.npmrc`.
6. About 2:09 p.m. Crescent staging click test on `https://cifpdil.staging.fireultimate.app` passed. No step failed.

## Click-test record
Passed: sign-in, dashboard, logout, login again, Allowed Senders exact and on, Raw Email, a personal message to the CAD mailbox did not appear, incidents, NERIS Validate required fields, change history, report In Review on NERIS and View Exports, `/API/users` showed an error and no user list, five wrong passwords locked username `admin`, the correct password stayed locked, `admin1` signed in.

Export was not clicked.

Two follow-ups were parked and are not failures:
- Resources “Dispatched and canceled en route” did not fill Dispatch Time, Canceled Time, and Clear Time from the call arrival time. The operator typed the times.
- Edit My Display stayed in the same browser across logout and across `admin1`. A different browser did not have those choices. Save it per person on the server later.

The sign-in page looked wrong after the promote (form at the bottom). The operator later said it appeared fixed. Auth page markup and auth CSS match the pre-promote commit. Under 820px the columns stack, and the logo image is 1024×1536, so a narrow window puts Login at the bottom.

Earlier the same day, a dashboard `NODE_ENV=production` row broke a rebuild of the old commit `fedb881` because npm skipped devDependencies. The operator deleted that row. Do not add it again on staging or production. Render already sets `NODE_ENV=production` for the running server only.

## Do not
- Rebuild the screen, Part 0, or fixes 1–14.
- Build parked items (Recover Reports, incident Status Draft, Configure Table drag, left-menu hiding, canceled-en-route times, per-user Edit My Display).
- Create `FIRE_RECOVERY_CREDENTIAL_KEY`. Save a Fire Recovery password in production. Start Step 15 or the Fire Recovery email.
- Run seed or `migrate reset`. Point tests at anything other than `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable`.
- Republish the live repair-plan canvas unless the user asks. The repo copy was updated. Canvas id `3b7445ce-b395-4e16-b948-f84dab1ca136`.

## Older notes
Files dated 2026-10-31 still say “not released.” That was true that day. Trust `ACTIVE_CONTEXT.md` and the Status line in `docs/plans/security-remediation-plan.md`.
