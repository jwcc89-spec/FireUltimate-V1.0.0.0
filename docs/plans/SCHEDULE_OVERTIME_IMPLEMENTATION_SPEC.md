# Schedule Overtime Implementation Spec

## Definitions

- **Slot:** one required coverage position for a row on a single schedule day.
- **Coverage window:** the full shift window for that day (example: `07:00 -> 07:00` next day for 24h shifts).
- **Segment:** a timed sub-range inside one slot (`start`, `end`, assignee).
- **HIRE segment:** auto-generated segment for uncovered time.
- **Trade segment:** a segment created from an approved trade request.

## Display Rules

- Single segment in a slot: `F.LastName` (example: `T.Johnson`).
- Multiple segments in a slot: `LAST3FIRST1` tokens joined by ` / ` (example: `JOHT / KELL / JOHT`).
- Literal token `HIRE` is used for auto-fill uncovered windows.

## Acceptance Scenarios

1. **24h single assignment**
   - Shift starts `07:00`, duration `24`.
   - One segment from `07:00` to `07:00` next day.
   - Slot is not red if qualifications are satisfied.

2. **Partial replacement mid-shift**
   - `07:00-15:00` A, `15:00-19:00` B, `19:00-07:00` A.
   - Slot displays compact token list and does not widen day column.

3. **Dynamic HIRE**
   - Segment coverage only `07:00-19:00`.
   - Auto HIRE appears for `19:00-07:00`.
   - Slot remains red until uncovered gap is resolved and qualification checks pass.

4. **Minimum slots check**
   - Apparatus minimum `2` creates two independent slot checks.
   - HIRE can appear in one slot while another is fully covered.

5. **Trade workflow state**
   - Requester submits trade.
   - Counterpart accepts/denies.
   - Either captain can approve/deny.
   - Deny requires reason.

## Current Implementation Wave Notes

- Shift Start Time is now required in Scheduler Settings shift entries.
- Personnel Schedule blocks coverage calculations when the active shift has no explicit Start Time configured.
- Segment storage is persisted tenant-scoped through `/api/schedule-assignments` payload.
- Legacy slot string data remains readable (backward-compatible).
