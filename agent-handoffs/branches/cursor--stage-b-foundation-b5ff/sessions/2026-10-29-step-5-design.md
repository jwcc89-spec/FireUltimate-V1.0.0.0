# Session note — Step 5/6 design (secure sessions and access controls)

## What was done
- Designed Step 5 (server-side sessions) and Step 6 (permissions) before any coding, at the user's request.
- Published design canvas: https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/a9d0e635-88a9-45c5-89c8-ab93873f7618
- Repo copy: `docs/plans/canvases/step-5-6-secure-sessions-design.canvas.tsx`; indexed in `docs/plans/canvases/README.md`.
- No app, server, schema, or Render changes.

## Design summary
- Stored sessions (new add-only `Session` table, only a SHA-256 hash of a random token kept) instead of JWT, so logout and password changes revoke access instantly. No new Render secret.
- Cookie: HttpOnly, Secure (relaxed on localhost), SameSite=Strict, host-only; session bound to tenant.
- Role read from `User.role` on every request; payloadJson user-type labels and browser storage no longer grant access.
- Secure by default: one global sign-in check after tenant resolution, with a public allowlist (login, tenant context, CAD inbound email, `/api/admin/*` with platform key, static files). Route-list test guards new routes.
- New routes: `GET /api/auth/session`, `POST /api/auth/logout`. Change-password uses the signed-in user. Origin check on data-changing requests.
- Frontend: "who am I" on load; sign-in box over the current screen on any 401 so unsaved typing is kept.

## Decisions waiting on the user (before coding)
1. Approve the Session table (add-only migration).
2. Timeouts: recommended 12 h idle / 24 h maximum.
3. Lockout: 15 minutes after 5 wrong passwords.
4. Clear cached department data on logout.
5. Approve the auth code changes listed in the "What changes" tab.

## Can wait until Step 6
- Default for NERIS export and manual incident creation (all users vs admins).
- Approve role-permission and account-change-log tables (add-only).

## Now vs Later
- Now: wait for the user's answers.
- Later: implement Step 5 on this branch, install a throwaway local Postgres for tests, then Step 6.
