# Agent Handoff Note

## Session metadata
- Date: 2026-10-31 (America/Chicago, UTC-5), evening session after the Stage B click-through.
- Agent type: Cloud
- Agent name/label: Grok 4.7
- User request focus: Review `docs/plans/security-remediation-plan.md` and start implementing it so Stage B can finish and Stage C can start. Explain the operator steps in beginner language.
- Working branch: `cursor/stage-b-foundation-b5ff` (slug `cursor--stage-b-foundation-b5ff`)
- Pull request: https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31 (base `submenu/neris-golive-cifpd`). **Do not merge.**

## Starting context
- Latest known commit at start: `2643221` (the security plan, docs only). The plan was still marked awaiting approval.
- The user said to start implementing. That approved the build order: Fix 4, then Fix 1, then Fix 2, then Fix 3.
- Known rule: do not touch staging, production, Neon, Render, or Cloudflare. Do not start Step 10 unless the user says start.

## Work completed
- **Fix 4 (tests only).** `server/auth/sessions.test.mjs` now checks a made-up cookie, a tampered cookie, a cancelled session, a session used on another department's address, and `revokeAllSessions` signing the user out on every device. The origin scheme/port gap (item D5) is recorded as a known gap: same host with a different scheme or port is still accepted.
- **Fix 1 (failed sign-in memory).** `server/auth/sessions.mjs` and `POST /api/auth/login` in `server/neris-proxy.mjs`. A username longer than 100 characters, or a password longer than 256, gets "Invalid username or password" and is not stored. The in-memory failure list stops at 10,000 rows. Expired rows go first, then the oldest rows that are not locked. A locked account is never removed to make room. If every row is locked, a new unknown username gets "Too many sign-in attempts. Try again later." A correct password still signs in. Locks still reset when the practice proxy restarts.
- No Prisma schema or migration changes. No CAD behavior change yet. No Fire Recovery change yet.

## Decisions made
- The user's "start implementing" approved Fix 4 and Fix 1's memory-cap approach on this practice branch.
- Fix 1 ships before the Neon username-length query only because this branch is not promoted. Promotion still requires that query to show a longest username of 100 or less. If it is higher, raise the cap before release. Do not promote first.
- Fixes 2 and 3 wait for the operator to confirm the setting name `CAD_INGEST_SECRET` exists. Writing fail-closed CAD before that confirmation would be the next session, still without deploying.
- Stage C / Step 10 was not started.

## Verification
- `npm run lint` pass (existing Babel note about `src/App.tsx` size only).
- `npm run build` pass (existing chunk-size warning only).
- `npm test` 16/16 against local `fu_session_test` only. Never pointed at Neon.
- Fix 4 was committed and tested before Fix 1. Fix 1 was linted, built, and tested before commit.
- The practice proxy was not restarted. The running proxy still has the previous sign-in code until the next restart. Restarting signs people out and clears the in-memory lock.

## Git status
- `497b667` test: cover Stage B session refusals
- `e3c222e` fix: cap failed sign-in memory use
- This handoff is a later docs commit. Read `git log -1` after it is pushed.
- Not merged. Staging and production were not changed.

## Open issues / blockers
- Part 1 of the security plan is the operator's job: production `admin` and `demo` passwords, staging Neon backup plus clearing the Fire Recovery password, the read-only Neon counts, and confirming the `CAD_INGEST_SECRET` name on Render and the Cloudflare Worker. Do not ask the operator to paste secret values.
- Fixes 2 and 3 are not built.
- Fixes 5, 6, and 7 (Stage C billing) are not built.
- Parked click-through items stay parked.

## External dependencies
- Neon, Render, and Cloudflare are unchanged. The operator must use those dashboards for Part 1.
- Ask Fire Recovery USA to change the password that was saved on staging before Fire Recovery goes live. The old password remains in the 2026-10-28 staging backup.

## Next steps for next agent
1. Stay on this branch. Do not merge.
2. After the operator confirms the `CAD_INGEST_SECRET` name, implement Fix 2, then Fix 3, one commit each. Run lint, build, and `npm test` after each.
3. Do not start Step 10 until the user says start Step 10. When they do, Fix 5 is the first Stage C security item.

## Notes for user communication
- The user does not need to click anything in the practice app for Fix 4 or Fix 1.
- Give numbered dashboard steps for Part 1. Tell them to send back counts and migration names only, never passwords or secret values.
