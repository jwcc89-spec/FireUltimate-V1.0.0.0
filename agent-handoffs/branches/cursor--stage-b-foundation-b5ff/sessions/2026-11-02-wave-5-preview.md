# 2026-11-02 — Wave 5 preview screen

Practice branch `cursor/stage-b-foundation-b5ff` only. Render, Neon, staging, and production were not touched.

## What changed

- Core dispatch location and incident location are read-only. Each line is built from the street, city, state, and ZIP under it. An arrow hides those four fields. Street is half a row, and the four fields use two rows. Same as dispatch sits beside the Incident location label.
- Export Details replaces the instant Send button with a Fire Recovery panel: status, tracking ID, invoice status, amounts, Preview & Send, Update billing status, and Resolve review for an admin when the status is Needs review.
- The export queue, the Fire Recovery list, and the detail page show Not sent, Submitting, Sent, Failed, or Needs review.

## Not done

Wave 5b (re-export, then bill) is still waiting on a staging NERIS re-export check. Do not click Confirm and send on this Mac.

## Location follow-up (later the same day)

Incident location keeps one state and one ZIP. Country and county moved into that section. Country defaults to US. The separate State/Territory and Postal code fields are hidden. Export still sends `state`, `postal_code`, `country`, and `county`. The Motor Vehicle Collision NERIS code box is hidden; Fire Recovery uses the Core primary incident type.

Incident 12345 first returned 400 Bad Request. The stored reason was "Missing NERIS entity ID." After the operator set the entity, the same report exported: status Exported, last attempt 201 Created at 11:14:04 America/Chicago. The screen is Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration.

## Next

Wait for the user's review. Do not start Wave 5b or Wave 6. Wave 6 is the local fake-vendor test file.
