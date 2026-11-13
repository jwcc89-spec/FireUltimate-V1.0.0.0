# Session summary — November 13, 2026

Wave 8 went to production. Crescent’s first real Fire Recovery bill was accepted.

Tracking ID: `412c2d90-6489-4b63-9fa0-6570adf33bb2` (run 2026-006). Fire Ultimate shows Sent. Recovery Hub shows Draft. That Draft state is expected until someone finishes the run in Recovery Hub. The API does not automatically finalize the invoice.

Fire Recovery answered the eight email questions. The Welcome login works for real bills. Sandbox IDs are never billed. Party role fields can stay blank. NERIS codes use the full `MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION` value. Corrections can be re-sent only if Recovery Hub has not edited the run. Commercial trucking marks, lost tracking IDs, and billing-status timing are still waiting on their development team.

Later the same day:

- Filed By now uses the person’s full name, not the sign-in name.
- A successful NERIS export marks the report Exported on the server, so officers who are not admins see Exported.
- The NERIS reporting table shows the last part of the primary incident type as words, such as Motor Vehicle Collision.

Still open: why Recovery Hub left the cleared time blank, and why Is Resident No did not show. Do not change those until Fire Recovery explains them.
