# Agent Handoff Note

## Session metadata
- Date: 2026-10-31 (America/Chicago, UTC-5), evening session that started about 9:46 p.m.
- Agent type: Cloud
- Agent name/label: Grok 4.7
- User request focus: Build security Part 3 on the practice branch. Fix 5, then Fix 6, then Fix 7. One fix per commit.
- Working branch: `cursor/stage-b-foundation-b5ff`
- Pull request: https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31. **Do not merge.** Base stays `submenu/neris-golive-cifpd`.

## Work completed
Part 3 code is built, linted, built, and tested. Nothing was deployed. Staging, production, Neon, Render, and Cloudflare were not touched. No Prisma schema or migration change. `FIRE_RECOVERY_CREDENTIAL_KEY` was not created on Render. No Fire Recovery password was saved in production.

Commits, oldest first:
- `6fba67f` — Fix 5. After NERIS replies, `POST /api/neris/export` writes the export-history row (success or NERIS error). The signed-in username is the report writer. `POST /api/neris/export-history` accepts only `attemptStatus: "failed"`. A browser success post is refused. Billing readiness requires `responseDetail` to start with `server-receipt:v1`. The browser posts a failure only when the server did not already record the reply (timeout or network). The screen reloads history after a server receipt.
- `abe48a7` — Fix 6. New `server/crypto/secretBox.mjs`. AES-256-GCM. Stored value starts with `enc:v1:`. The key is SHA-256 of `FIRE_RECOVERY_CREDENTIAL_KEY`. Settings replies say only whether a password is saved. A readable stored value is refused with "re-enter the password". There is no automatic conversion. Error text is scrubbed so the password is not returned or stored in `lastSubmitError`.
- `55b0bf7` — Fix 7. `billing.view` in `server/auth/permissions.mjs`, default role admin. It protects `GET /api/fire-recovery/incidents` and `GET /api/fire-recovery/incidents/:callNumber`. A regular user gets 403. An admin gets 200. The NERIS queue and export queue hide the Fire Recovery link and the billing column without that permission. The Fire Recovery pages say "Billing information is not shown for this sign-in." They do not show an error.

Verification after each fix: `npm run lint`, `npm run build`, and `npm test`. Final run: lint pass, build pass (existing chunk-size warning only), tests 22 pass. Tests used only `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable`.

This cloud machine did not already have Postgres or the practice site. Local Postgres 16 was installed for the tests. User `fu` / password `fu`, databases `fu_session_test` and `fu_practice`. The practice Vite server and proxy were not running at the start and were not restarted. The user was not asked to paste terminal commands.

## Decisions that stay in force
- Do not merge until `Session`, `RolePermission`, `AccountAuditLog`, and `NerisReportChange` exist on staging, with a fresh backup and written approval.
- Do not release this branch until Stage D has saved `dispatch@co.iroquois.il.us` for Crescent. Fix 3 rejects mail when the allowed-sender list is empty. Staging `cifpdil` had 0 allowed senders.
- Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` on Render in a coding session. Staging and production need different values. A copy stays in the password manager. If the key is missing, a new password is not saved.
- Do not save a Fire Recovery password in production, and do not submit bills from production, until fixes 5–7 are live there.
- `billing.view` defaults to admin. A department admin can lower it later in the existing permission screen.
- Do not build the allowed-sender screen, Recover Reports, the incident Status dropdown, Configure Table drag, or left-menu hiding.
- Do not upgrade Prisma. Stay on 7.10.1.
- Practice sign-in remains `demo` / `demo` unless the user changed it. Time display stays 24-hour.

## Next steps for next agent
1. Stay on `cursor/stage-b-foundation-b5ff`. Do not merge. Do not touch staging, production, Neon, Render, or Cloudflare.
2. Part 3 is done. Wait for the user's next request. Likely later work is Stage C step 11 (billing preview and Confirm), the sandbox Fire Recovery department ID, or a planned release. Do not start those unless asked.
3. Before a release, the operator still has to save `dispatch@co.iroquois.il.us` (Stage D, step 23) and create `FIRE_RECOVERY_CREDENTIAL_KEY` on Render. This session did not do either.
4. If the practice site at `http://localhost:5173` is down, start it. Do not restart it only to pick up the new code unless the user is about to click or the process is down.
5. The repair-plan source in the repo already describes Part 3. The live canvas was checked after that commit and still showed the older Step 10 wording (no "Updated" status, and no October 31 security decision row). Republish canvas id `3b7445ce-b395-4e16-b948-f84dab1ca136` from `docs/plans/canvases/repair-plan.canvas.tsx`. Omit the title. Do not rewrite the plan.
