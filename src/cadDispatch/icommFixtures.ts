/**
 * Synthetic ICOMM-style dispatch bodies for tests (not real customer data).
 * Two messages share the same CFS for merge/update scenarios (later batches).
 */

/** Initial dispatch — structure fire, multiple units. */
export const ICOMM_FIXTURE_INITIAL_DISPATCH = `ICOMM CAD — NEW INCIDENT
CFS: 25-004567
CALL: 2025-00098765
NATURE: STRUCTURE FIRE
ADDR: 123 N MAIN ST / MAPLE AVE
CITY: CRESCENT
TIME: 14:32:05
UNITS: E4, L1, M3, BC1
NOTES: SMOKE SHOWING FROM SIDE B`;

/** Update / close for same incident — same CFS, status line. */
export const ICOMM_FIXTURE_UPDATE_DISPATCH = `ICOMM CAD — UPDATE
CFS: 25-004567
STATUS: CLEAR
ADDR: 123 N MAIN ST
UNITS CLEAR: E4, L1, M3
NOTES: FIRE OUT — INVESTIGATION COMPLETE`;
