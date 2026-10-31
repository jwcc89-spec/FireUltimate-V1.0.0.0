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

## User answers (2026-10-29, ~01:48 CDT)
- Questioned the "no sign-in needed" claim (the page showed a login screen). Verified with a read-only request: `GET https://cifpdil.fireultimate.app/api/users` without signing in returned HTTP 200 with 21 accounts (only the count was printed). The login screen hides pages in the browser; the server does not check. No writes were tested on production.
- Timeout: 60 minutes. Recorded as 60 minutes of inactivity, pending user confirmation (vs a hard 60-minute limit).
- Lockout: yes (5 wrong / 15 minutes).
- Clear cached data on logout: yes. Also sign out when the browser closes (session cookie with no Max-Age, plus the server inactivity limit).
- Still open: decision 1 (Session table; plain explanation added to the canvas) and decision 5 (approve auth code changes).

## Can wait until Step 6
- Default for NERIS export and manual incident creation (all users vs admins).
- Approve role-permission and account-change-log tables (add-only).

## Now vs Later
- Now: wait for the user's answers.
- Later: implement Step 5 on this branch, install a throwaway local Postgres for tests, then Step 6.
