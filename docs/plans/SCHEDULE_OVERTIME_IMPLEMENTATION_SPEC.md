# Schedule Overtime Implementation Spec

This document is the **source of truth** for schedule segmentation, overtime (OT), dynamic HIRE, additional fields, and related UI. It supersedes informal notes when there is a conflict. Tenant isolation and persistence via `assignmentsJson` / schedule APIs remain as in `docs/task-2-multitenant-domain-plan.md`.

---

## Confirmed product decisions (reiteration)

1. **Save / commit model**  
   Use **per-slot (or per-segment-group) Apply** as the primary pattern: segment **structure** (times, count of segments) is edited in a focused flow (e.g. builder popup) and **committed** before it becomes authoritative for the day block. Avoid silent whole-day rewrites until Phase 2 rules and previews exist. *Alternative already rejected for v1:* live auto-save to the entire day on every keystroke without scope.

2. **What “OT” means**  
   **Overtime** = a member is **hired back** to fill open coverage. Per-segment OT flags drive **OT hiring workflow** eligibility and **distinct styling** for that segment. A **single apparatus slot** may contain **both** OT and non-OT segments.

3. **Segmentation vs OT**  
   **Splitting / segmenting** a row (coverage broken into timed pieces) is **orthogonal** to OT. Segmentation can exist without OT; OT is evaluated per segment when applicable.

4. **Additional fields (support rows)**  
   Treated as **time off / alternate assignment** rows. A **full** assignment for a row represents the **same coverage window as the shift** (typically **24 hours** from configured shift start). **Side-by-side segmented UI** applies to **additional fields as well as apparatus** (same family of UX).

5. **HIRE placeholder**  
   HIRE logic runs **whether or not** “split mode” is on for a row. It is **not** tied only to segment UI state.

6. **Hour math for support**  
   Time in **segmented additional fields** (e.g. sick) **subtracts** from that person’s **obligated coverage hours** for the day when computing whether they still “owe” time elsewhere (Phase 2).  
   **Example:** Sick **20h** means that person must still appear **elsewhere on the same day block** for the remaining **4h** (non-overlapping apparatus or other valid placement). The **4h is not “excused”** unless product rules explicitly add an excused type later.

7. **Minimum staffing**  
   Where an apparatus row has **multiple required positions** (e.g. Engine 6 minimum 2), accounting must be **per person** and **per position**, because positions may require **different qualifications**.

8. **No overlapping time for the same person**  
   The same person **cannot** be scheduled on **two apparatus assignments** (any units/slots) for **overlapping** times. **No automatic move** from one apparatus to another: the user must **remove** or **segment** assignments manually so intervals do not overlap.

9. **Apparatus override (formerly “Personnel override”)**  
   In **Scheduler Settings → Additional Fields**, the flag is labeled **Apparatus override** in the UI. When checked, placing that person in the additional field **while they still occupy apparatus time** triggers **auto-segmentation on the apparatus slot(s)** so they remain on the apparatus only for hours **outside** the additional-field interval.  
   **Example:** Josh is on Engine 6 slot #2 full shift; he is placed on **Sick** `12:00`–`07:00` (19h). Engine 6 #2 auto-segments to **`07:00`–`12:00`** with Josh, and **`12:00`–`07:00`** as the remaining portion of that slot (to fill with OT/another member/HIRE as rules dictate).

10. **Cross-apparatus overlap (no auto-fix)**  
    If an action would place the same person on **another apparatus** with **overlapping** times (including “full shift” vs partial segment overlap), **block** the action and show a popup:  
    **`<PersonnelName> already assigned to <ApparatusLabel>. Remove or segment assignments so times do not overlap.`**  
    The user must correct assignments manually; the app does **not** auto-split across two apparatus rows.

11. **Segment time display**  
    Whenever a slot is shown in **segmented** form in the day-block modal, each segment shows **start and end time** in **small text** (e.g. italic) **below** the assignee area so the window is visible at a glance (in addition to any time editors).

---

## Definitions

- **Slot:** One required **position** on a row for a single schedule day (one “seat” of coverage). Apparatus rows use `minimumPersonnel` to define how many slots exist. Additional fields do **not** use `minimumPersonnel` for HIRE; see **Dynamic HIRE** below.
- **Coverage window:** The shift window for that day (example: `07:00` → `07:00` next day for 24h shifts), derived from **Scheduler Settings → Shift Information** (start time + duration). **Not hardcoded per tenant.**
- **Segment:** A timed sub-range inside one slot: `start`, `end`, assignee (personnel or HIRE), optional **OT** flag, `source` (`manual` | `trade` | `auto_hire`).
- **Split / segment mode (UI):** User enables timed pieces for a row’s slot(s). Default for **Standard** additional-field/apparatus behavior uses tenant **shift length** and **standard OT slot length** (e.g. 24h / 12h → **2** default segments). **Custom** mode uses user-defined start/end per segment (see below).
- **HIRE segment:** Auto-generated segment (or placeholder token) for **uncovered** time or **unfilled apparatus slots** when rules say OT hire is needed.
- **Trade segment:** Segment created or updated from an approved **trade** request (`source=trade`).

**Persistence note:** The stored field may remain `personnelOverride` in JSON for backward compatibility; UI copy is **Apparatus override**.

---

## Scheduler Settings — additional field segmentation modes

Each **additional field** (in Admin → Scheduler Settings → Additional Fields) should support **how segmentation behaves** when “segmented” is enabled:

| Mode | Behavior |
|------|----------|
| **Standard** | When segmentation is on, the row uses the tenant’s **Shift Length** and **Standard Overtime Slot** (same inputs used elsewhere, e.g. 24 / 12 → **2** default side-by-side segments filling the window). |
| **Custom** | When segmentation is on, show **narrower** segment editor(s) requiring **explicit start and end** per segment (e.g. sick for **20 hours**). The person must still satisfy **remaining hours** elsewhere on the day block (see §6 above). *UI may evolve later; v1 may be modal-heavy.* |

**Apparatus override** and other existing per-field flags remain unless superseded above.

---

## Dynamic HIRE (full algorithm — target behavior)

HIRE evaluation is **independent** of whether any row is in “split” UI mode.

**Step A — Shift roster coverage**

- Consider all personnel **assigned to the active shift** for that day.
- For each such person, their **scheduled time** across apparatus + applicable additional fields must total the **full obligation** (typically **24 hours** in the shift window), with **no overlapping** apparatus intervals for that person.

**Step B — Are we “fully assigned” as a shift?**

- **Yes** only if: every shift-assigned member has placements that **account for 24h** (Phase 2), and there are **no** uncovered gaps per rules.
- If **no**, do **not** advance to apparatus HIRE-by-minimum logic for “all shift bodies placed” (other red/validation states apply).

**Step C — Apparatus minimum openings**

- **Only if Step B is satisfied:** consider **apparatus** rows with `minimumPersonnel` (and qualifications).
- If any **required apparatus slot** is still **open** (unfilled or uncovered per segment rules), insert **HIRE** placeholder(s) as needed.
- **Additional fields** do **not** define `minimumPersonnel`; they do **not** drive “minimum slots” HIRE. They **do** affect **whether people are available** and **hour totals** (sick, vacation, etc.).

**Display:** HIRE tokens follow tenant OT split (e.g. two **12h** HIRE tokens → `HIRE / HIRE` in compact view) when that is the configured chunk size.

---

## Phase 1 — UI: segment toggle, side-by-side slots, builder popup

**Goal:** Replace the mental model “OT checkbox = split” with **“segment / split”** as the primary control next to each apparatus **slot row** (and parallel UX for additional fields).

- **Checkbox** next to the row means **enable segmentation** for that slot row (wording TBD in UI: e.g. “Segment” or “Split”).
- When checked, the row shows **two side-by-side drop targets** by default, each covering **half the window** per **Standard** math: e.g. **12h + 12h** when shift is 24h and **Standard Overtime Slot** is 12 (tenant-configurable).
- **Green [+]** on the row opens a **popup** to define **N segments** with explicit **start/end** for each; on **Save**, the row shows **N** side-by-side (or wrapped) empty segments; user drag-drops assignees per segment.
- **Per-slot Apply / Save** for structural edits (per earlier agreement) so the day block does not partially update ambiguously.

**In scope:** Apparatus **and** additional fields using the same **side-by-side** pattern (with **Standard** vs **Custom** per field as above).

**Engineering note:** Persist using existing **segment** structures in `assignmentsJson`; extend with **per-segment `ot: boolean`** (or equivalent) before OT workflow UI ships.

---

## Phase 2 — Per-person and per-position hour accounting

**Goal:** For each **day block** and **active shift**:

- Compute each person’s **total scheduled minutes** across all apparatus segment assignments and time-off segments (additional fields), with **no illegal overlap** on apparatus.
- **UI signal:** If a person is only scheduled **12h** on one apparatus, their name / indicator on other required areas should reflect **remaining obligation** (e.g. not “green complete” until **12h** remains placed somewhere **non-overlapping**).
- **Per position:** For **two slots** on the same apparatus with **different qualifications**, validate **each slot** independently (coverage + quals), not only “person totals.”

---

## Trades (existing plan)

- Trades continue to mark affected segments with `source=trade` and optional trade refs.
- Approved trades **replace assignments** for payroll/scheduling purposes per prior decision.
- Trade rows / compact notation in the day block remain as previously specified (captain approval, either captain).

---

## Display rules

- **Calendar / month grid:** Unchanged philosophy — **compact**: single segment → `F.LastName`; multiple → `LAST3FIRST1` tokens joined by ` / `; literal **HIRE** preserved.
- **Day block modal:** Side-by-side segments show **assignee** with **smaller italicized time range** under each segment (required whenever segmented).

---

## Acceptance scenarios (high level)

1. **24h single assignment** — One segment `07:00`→`07:00` next day; slot satisfies quals → not red.
2. **Partial replacement** — Multiple segments, same slot; compact tokens; column width stable.
3. **HIRE with segmentation off** — Uncovered apparatus time still gets HIRE when **Step C** conditions met.
4. **HIRE with segmentation on** — Same HIRE rules; segments may show HIRE per uncovered slice.
5. **Two minimum positions, different quals** — Each position tracked; HIRE can appear for one slot only.
6. **Standard vs Custom additional field** — Standard gives 2×12 default; Custom 20h sick → **4h** required elsewhere same day.
7. **Apparatus override + sick partial** — Apparatus auto-segments; person only on apparatus for non-sick hours.
8. **Cross-apparatus overlap attempt** — Blocked with popup; no silent move between apparatus.
9. **Trade** — Counterpart + captain flow; schedule updates; HIRE recalculates.

---

## Current implementation notes (codebase)

- Shift **Start Time** is **required** in Scheduler Settings shift entries; schedule blocks if missing.
- Segment storage is **tenant-scoped** via `/api/schedule-assignments` payload (`assignments`, `overtimeSplit`, `slotSegments` as implemented).
- Legacy string-only slot data remains readable.
- **Cross-apparatus overlap:** blocked on assign (full-window and segment drops where implemented); other entry paths should use the same checks over time.
- **Phase 1 UI (partial):** Day-block modal uses a **timed-segments** checkbox (same persisted `overtimeSplit` flag). The checkbox has **no visible “Segment” label** (tooltip + `aria-label` describe behavior; onboarding explains). Segments render **side-by-side** cards; **OT** is a **per-segment** checkbox on apparatus rows (`ScheduleSegment.overtime`). When **OT** is checked on a segment, the assignee dropdown uses the **full OT roster** (`overtimeRosterPersonnel`: personnel with **name + shift** set in Scheduler Personnel—excludes empty/demo shells). **Shift** list for a segment **greys out** people already assigned on **another segment of the same slot**; use **OT** on that segment to pick from the full roster. Cross-apparatus overlap checks are skipped for OT segments. **Green +** opens **Segment layout** (edit intervals, **Apply**). Segment times show as **italic HH:MM–HH:MM** only (no duplicate time inputs on the card). Small **red ×** control top-right removes a segment; if only **one** segment remains (or zero), segment mode **turns off** and the slot returns to a **single 24h** assignment. **Standard | Custom** per additional field in admin is **not** implemented yet; Phase 2 hour ledger pending.

---

## Now vs Later

| Now | Later |
|-----|--------|
| Align modal UI with Phase 1 segment + popup | Polished responsive layout for many segments |
| Per-segment OT flag in JSON | Full OT hiring workflow backend |
| Phase 2 hour accounting | Audit log / history of segment edits |

---

## Verification (when implementing)

- `npm run lint` and `npm run build` after each batch.
- Manual: two tenants, no cross-tenant leakage; HIRE only after shift fully covered + open apparatus slots; 20h sick → must place 4h elsewhere; apparatus override auto-segment; blocked cross-apparatus overlap shows popup.

---

## Resolved (formerly open)

- **Overlap:** **Not allowed** across apparatus for the same person for the same time range.
- **Custom sick &lt; 24h:** Remaining hours **must** be scheduled elsewhere on that day block (not excused by default).
