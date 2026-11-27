# 2026-11-27 — W7 Fire Prevention schema proposal (America/Chicago)

Agent: Claude Opus 5.5. Branch: `feature/demo-modules`. No schema, migration or code written.

## Asked
- Start W7: restate the task, propose the schema, and wait for explicit approval.

## Proposed (waiting for approval)
- One migration `20261130100000_add_fire_prevention` (would make 26), additive only:
  - `Property`: name, address, unit, city, state, postalCode, normalizedAddress, propertyType, occupancyType, squareFeet, yearBuilt, latitude, longitude, streetViewPanoId/Heading/Pitch/Zoom, photoRef, detailsJson. Indexes on tenantId, (tenantId, normalizedAddress), (tenantId, propertyType).
  - `PropertyContact`: propertyId, firstName, lastName, businessName, role, isPrimary, phone, email, mailing address (street, unit, city, state, zip), detailsJson.
  - `PrePlan`: propertyId, template (basic/complex), title, reviewedOn, detailsJson.
  - `Inspection`: inspectionNumber (FPI-YY-NNNN), propertyId, inspectionType, isReinspection, reinspectionOfId, receivedOn, scheduledOn (date) + scheduledTime (HH:MM), status, leadInspector, otherInspectors, reason, district, division, station, shift, unit, templateVersionId, completedOn, resultsJson, detailsJson.
- Reused without change: ChecklistTemplate/Version (subjectKind `fireInspection`), Comment, Geofence (linkedPropertyId/linkedPrePlanId), Incident (call history matched at request time, no new column).
- Permissions: no new keys; reads `incidents.view`, writes `prevention.manage` (open question about members completing inspections).

## Next
- Operator answers the open questions and approves (or changes) the tables, then batch 7a starts.
