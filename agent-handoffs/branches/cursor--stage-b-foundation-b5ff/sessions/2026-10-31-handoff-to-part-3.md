# Agent Handoff Note

## Session metadata
- Date: 2026-10-31 (America/Chicago, UTC-5), about 9:40 p.m.
- Agent type: Cloud
- Agent name/label: Grok 4.7
- User request focus: End the security chat. Record that the allowed-sender screen stays in Stage D. Give the next agent a prompt that starts at Part 3 of `docs/plans/security-remediation-plan.md`.
- Working branch: `cursor/stage-b-foundation-b5ff`
- Pull request: https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31. **Do not merge.** Base stays `submenu/neris-golive-cifpd`.

## Work completed
Documentation only. No application code. Nothing deployed. The operator decided the one screen that lets an admin add `dispatch@co.iroquois.il.us` waits for Stage D of the repair plan (step 23). They typed `dispatch@co.iroquios.il.us` once; the correct address in the plan is `dispatch@co.iroquois.il.us`.

Updated:
- `docs/plans/security-remediation-plan.md` — Part 1 complete. Part 2 code complete and not released. Next implementation is Part 3.
- `docs/task-2-multitenant-domain-plan.md` — Now vs Later security line.
- `docs/plans/canvases/repair-plan.canvas.tsx` — step 23, October 31 decision row, header. Republish canvas id `3b7445ce-b395-4e16-b948-f84dab1ca136`. Omit the title.
- `ACTIVE_CONTEXT.md` and `COPY_PASTE_START_PROMPT.md`.
- Older same-day notes that said "build the allowed-sender screen next" now point here: `sessions/2026-10-31-part-1-complete.md` and `sessions/2026-10-31-security-fixes-2-and-3.md`.

## Decisions that stay in force
- Sign-in limits stay: 5 failures, 15 minutes, 10,000 remembered names, username max 100, password max 256.
- Part 1 is complete. Production `admin` password was changed. No production `demo` user. Staging passwords changed. Fire Recovery readable-text password count is 0 on both databases. Do not ask Fire Recovery USA to rotate a test password that was deleted. `CAD_INGEST_SECRET` exists on staging API, production API, and the Cloudflare Worker. Do not copy the secret value into notes.
- Production `_prisma_migrations` has 10 names through `20260411190000_fire_recovery_tenant_api_credentials`. This branch adds Session, RolePermission plus AccountAuditLog, and NerisReportChange. Do not apply those until a planned release (staging first, fresh backup, written approval).
- Fix 3 is already on this branch. An empty allowed-sender list rejects mail and saves nothing. Staging `cifpdil` has 0 allowed senders. Do not release this branch until Stage D has saved `dispatch@co.iroquois.il.us` for Crescent.
- Fix 6 key name is the Render setting `FIRE_RECOVERY_CREDENTIAL_KEY`. Different values for staging and production. A copy stays in the password manager. Do not create that Render setting in the coding session.
- Fix 7 `billing.view` defaults to admin.
- Do not save a Fire Recovery password in production or submit bills from production until fixes 5–7 are live in production.
- Do not start Step 15, the Fire Recovery welcome-message email, Recover Reports, the incident Status dropdown, Configure Table drag, or left-menu hiding.
- Do not upgrade Prisma. Stay on 7.10.1.
- Practice site is `http://localhost:5173`. Sign in `demo` / `demo` unless the user changed it. The user cannot paste into the terminal. Do not restart the practice proxy unless it is down or the user is locked out.

## Next steps for next agent
1. Stay on `cursor/stage-b-foundation-b5ff`. Pull before editing. Do not merge. Do not touch staging, production, Neon, Render, or Cloudflare.
2. Read Part 3 of `docs/plans/security-remediation-plan.md`. Build Fix 5, then Fix 6, then Fix 7. One fix per commit.
3. After each fix run `npm run lint`, `npm run build`, and `npm test`. Tests must use local `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable` only.
4. Fix 5: after NERIS replies, the server writes the export-history row. `POST /api/neris/export-history` accepts only failed browser-side records. The front end stops sending success. No schema change. Touches `POST /api/neris/export`, export-history, Fire Recovery readiness in `POST /api/fire-recovery/submit`, `src/api/nerisExportHistory.ts`, and `src/App.tsx`.
5. Fix 6: new `server/crypto/secretBox.mjs`, AES-256-GCM, stored value tagged `enc:v1:`. Settings reply is only yes/no. A readable-text value is refused with "re-enter the password". No automatic conversion. Logs must not include the password. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` on Render.
6. Fix 7: add `billing.view` in `server/auth/permissions.mjs` for `GET /api/fire-recovery/incidents` and `GET /api/fire-recovery/incidents/:callNumber`. Hide billing in `src/api/fireRecovery.ts` and `src/App.tsx`. Default role is admin. Defaults live in code. No database change.
7. Do not build the allowed-sender screen. That is Stage D, repair-plan step 23.
