# Fire Ultimate release checklist

Approved 2026-10-30 (Step 9 of the repair plan).

Use this for every release to staging or production. A release means telling Render to run a new copy of the code, or applying a database change. Saving code to GitHub does not change a live site.

## Before anything else

1. Name the release in one sentence: what will change, and which site (staging or production).
2. Confirm the practice branch tests passed: lint, build, and `npm test`.
3. List every database change. Each one must only add something. No deleting or renaming existing tables or columns.
4. Write how to undo it: which previous code copy Render should run, and that the database additions can stay in place because they are unused by the older code.

## Backup

5. In Neon, create a fresh backup branch before the release. Name it `backup-YYYY-MM-DD-reason`.
6. Open the backup and confirm the tables are visible. Write down the incident count.
7. Leave that backup alone. Do not connect the app to it, edit it, reset it, or delete it.
8. Keep Neon's live branch named `production` in both projects. Tell the projects apart by name: `fireultimate-prod` and `fireultimate-staging`.

## Staging first

9. Apply database additions to the staging database only after the backup exists and you have said yes in writing.
10. Release the code to the staging Render service only after those tables exist.
11. Sign in on the department's own staging address and check the change: sign in and out, a wrong password locks after 5 tries, a regular user cannot create an incident or send a NERIS report, and one department cannot open another department's incident.
12. Stop if staging fails. Leave production as it is.

## Production, only after staging passes

13. Take a new production backup the same way. A staging backup does not cover production.
14. Say yes in writing for production.
15. Apply the same database additions to production.
16. Release the code to the production Render service.
17. Sign in as Crescent and confirm the department still sees its own incidents and can open a NERIS report.
18. Leave CAD auto-create off until Stage D. Leave Fire Recovery submissions off until Stage C says otherwise.

## Never

- Run the script that creates `admin/admin` or `demo/demo` against production.
- Point Render production at a branch other than `main` without this checklist and a fresh backup.
- Put passwords, database addresses, or API secrets in chat, in the checklist, or in department settings JSON.
- Test Fire Recovery with any department ID other than sandbox ID `FD12345678`.
- Set `TRUST_PROXY=1` until Render is confirmed to replace `X-Forwarded-Host`.

## After

19. Write the date, the code version, the backup name, and whether the sign-in check passed.
20. If something is wrong, put the previous code copy back on Render. Do not delete the new tables.
