# Agent Handoff Note

## Session metadata
- Date: 2026-10-31 (America/Chicago, UTC-5), about 9:05 p.m. follow-up.
- Agent type: Cloud
- Agent name/label: Grok 4.7
- User request focus: Decide whether the failed-sign-in memory cap and the username/password length caps should be lower. Report Part 1 operator results.
- Working branch: `cursor/stage-b-foundation-b5ff`
- Pull request: https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31 (base `submenu/neris-golive-cifpd`). **Do not merge.**

## Starting context
- Fixes 4 and 1 were already committed (`497b667`, `e3c222e`).
- The operator confirmed `CAD_INGEST_SECRET` exists on staging, production, and the Cloudflare Worker, which unblocked Fixes 2 and 3.

## Work completed
- Kept the sign-in limits. Five wrong passwords still lock for 15 minutes. The 10,000 cap stays. Usernames over 100 and passwords over 256 are still refused. Longest real username is 12 in production and 13 on staging.
- Fix 2: CAD intake returns 503 when the secret is missing, on every computer. The header is compared with a timing-safe check. Wrong or missing header stays 401.
- Fix 3: an unknown department or an empty allowed-sender list is rejected and nothing is saved. `Name <address>` still matches an exact allowed email.

## Decisions made
- Do not lower the lockout from 5, the memory list from 10,000, the username cap from 100, or the password cap from 256.
- Do not deploy. Staging `cifpdil` has 0 allowed senders. There is no screen for that list yet.
- Production migration names were not returned as a name list. Get them before a production release.
- Stage C was not started.

## Verification
- `npm run lint` pass (existing Babel note about `src/App.tsx` size only).
- `npm run build` pass (existing chunk-size warning only).
- `npm test` 17/17 against local `fu_session_test` only.
- Practice proxy was not restarted. Live staging and production were not changed by this code.

## Git status
- `f94bd28` fix: require the CAD intake secret everywhere
- `b0d29b3` fix: reject CAD mail with no allowed sender
- This note is a later docs commit. Read `git log -1`.

## Open issues / blockers
- Before promotion, add `dispatch@co.iroquois.il.us` for Crescent. The app has the API and no screen.
- Copy production migration names from Neon before production release.
- Fixes 5, 6, and 7 are not built.

## Next steps for next agent
1. Stay on this branch. Do not merge or deploy.
2. When the user says start Step 10, build Fix 5 first.
3. If they ask for the allowed-sender screen, that is the missing piece before this branch can be promoted.
