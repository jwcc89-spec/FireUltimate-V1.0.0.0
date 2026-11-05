# 2026-11-02 — Wave 4 submit lock

Practice branch `cursor/stage-b-foundation-b5ff` only. Render, Neon, staging, and production were not touched.

## What changed

- Core has street, city, state, and ZIP for dispatch and for the incident. Same as dispatch copies dispatch into the incident. Filled parts rewrite the single-line address. Clearing all four parts leaves a CAD single line in place.
- Motor Vehicle Collision street, city, state, and ZIP stay read-only. Party address edits stay in the billing JSON.
- Person/Owner no longer has a vehicle section or an owner insurance company. Copy copies name, phone, and address only.
- Wave 4: add-only `submitStatus` and `submitStartedAt`. Preview never calls the vendor. Submit requires the preview hash, takes one lock, and saves Sent, Failed, or Needs review. A second send is 409. Resolve-review is admin only.

## Verified

`npm run lint`, `npm run build`, and `npm test` (42) against `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable` only. The Core address fields were not clicked in a browser.

## Next

Wave 5 is the Export Details preview. Do not start it until the user says so. Do not migrate Neon. Do not click Save Fire Recovery or Send to Fire Recovery on this Mac.
