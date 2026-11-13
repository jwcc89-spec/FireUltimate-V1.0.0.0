# Session — 2026-11-13 Wave 8 production bill and follow-up fixes

Branch: `submenu/neris-golive-cifpd`. Production: `main`.

## What shipped

- PR #43 cherry-picked the export-stamp fix onto staging (`898c92d`, plus a docs note).
- PR #44 merged staging into `main` (`347db1e`).
- Production Neon backup: `backup-2026-11-13-wave8-fire-recovery` (63 incidents). Leave it alone.
- Production migrations through the Fire Recovery submit-status migration were already applied. No new migrate was run.
- Crescent production allowed sender inserted before the code release: `dispatch@co.iroquois.il.us`, id `allow-cifpdil-dispatch-20261101`, exact, enabled. Do not delete.
- Operator set production Fire Recovery to live and entered the Welcome login. Do not print the credential key.
- Real bill: run `2026-006`, call `cmoaozwi1000w3dlvimfnwxfp`, tracking ID `412c2d90-6489-4b63-9fa0-6570adf33bb2`. Fire Ultimate status Sent. Recovery Hub shows Draft.
- `42d0718` / `main` `69cd69a`: NERIS export history and Fire Recovery Filed By use the department full name when the value is a username (`wicj` → Jeremy Wichtner).
- `6d13157` / `main` `9733211`: after NERIS accepts an export, the server marks the saved report Exported. The browser no longer re-saves In Review at the start of export. Production draft for `2026-006` was set to Exported by hand after a browser timeout left it In Review.
- `e1de705` and `22b366d` / `main` `b60eb44`: Reporting → NERIS and View Exports show the last segment of the primary incident type as words (Motor Vehicle Collision). The Incidents page still shows the type chosen when the incident was created.

## Vendor answers (do not rebuild)

Email items 1–4 and 7 are closed. Items 5 (commercial trucking mark), 6 (lost tracking ID), and 8 (billing-status timing) stay parked.

Cleared time was sent as `2025-11-11T13:59:45`. Alarm used the same 24-hour shape and imported. Recovery Hub left Time Call Cleared blank. Is Resident No was sent as `Isresident: false` and did not show. Do not change those mappings until Fire Recovery answers.

## Do not

- Create a branch unless asked.
- Click Confirm and send on this Mac.
- Send another live bill unless asked.
- Start Wave 5b or CAD batches J/K unless asked.
- Delete the production or staging allowed-sender row.
- Connect Render to the backup branch.

## Next

1. Wait for Fire Recovery on cleared time and Is Resident No, or run one different live MVC with Is Resident Yes only if the operator asks.
2. Optional production checks not done this session: CAD test email, and unsigned `/api/users` returns 401.
