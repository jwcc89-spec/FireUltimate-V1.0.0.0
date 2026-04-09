# CAD Email Parsing and Auto-Create Incident — Planning Doc

**Status:** Planning (not yet implemented).  
**Prerequisite:** NERIS cross-browser Phase 1–3; CAD emails already received and stored in `CadEmailIngest`.  
**Next step after NERIS:** Build this feature so departments can see incoming CAD emails, define parsing rules per tenant, and auto-create incidents (with optional call sequencing).

**Phased implementation and completion tracking:** `docs/plans/CAD_DISPATCH_PARSING_IMPLEMENTATION_PLAN.md` (strike through phases and batches there as work ships).

---

## 1. Goal

- **Where emails show up:** Admin Functions submenu **Dispatch Parsing Settings**. Incoming CAD emails are listed and viewable (expand row for raw body). Parsing rules and config to be added later.
- **Parsing configuration:** Per **tenant**. Each department sets up its own rules (their dispatch may send a different format). Setup is done by the department, not by the program owner.
- **When parsing is used:** When a new email arrives and parsing rules are applied, the app **auto-creates one incident** (draft). Fields are filled from parsed text where rules match; others stay blank. Apparatus is matched to Department Details apparatus list; unrecognized units (e.g. private ambulance) are not added.
- **Incident purpose:** (1) Give responders information immediately and during the call (address, units, dispatch notes; later map routing). (2) Pre-populate NERIS forms (current behavior). Incidents are separate from NERIS report locking; auto-created incidents start as **Draft**.

---

## 2. Email source and format

- **Single dispatch system** per tenant, but **not all emails are formatted the same**. Parsing rules must support multiple formats per tenant (e.g. “Format A” vs “Format B” or rule sets that can be tried in order).
- Raw emails are stored in `CadEmailIngest` (already implemented). Parsing Data will read from that (or a processed view) and show them for configuration and review.

---

## 3. Parsing rules — design (priority order)

Implement in this order:

1. **A — Predefined labels**  
   Dispatch uses labels (e.g. `Nature:`, `Address:`). We detect these labels and the admin confirms or edits the mapping (label → incident field). Not everything after each label may be used; only the mapped fields are pulled into the incident.

2. **C — Pattern-based rules**  
   Rules the admin builds in a form (e.g. regex or “line after ‘Nature:’”). Supports formats where labels aren’t consistent.

3. **B — Highlight and assign**  
   Admin highlights a chunk of text in a sample email and assigns it to a field. Can be added after A and C.

**Stackable rules (example):**  
“Between the **1st** [hard carriage return] and **2nd** [hard carriage return]” → field = **[Address]** (dropdown).  
- **Position:** dropdown (1st, 2nd, 3rd, 4th, … line or segment).  
- **Delimiter:** dropdown (hard return, comma, period, colon, semicolon, etc.).  
- **Target field:** dropdown (Address, Nature, Cross Streets, Units, etc.).  
Rules can be added over time; a list of rules from the current platform can be provided later and mirrored where applicable.

---

## 4. Apparatus matching

- **Source of truth:** **Department Details → Apparatus list** (already in the app).
- Incoming text (e.g. `E4`, `Crescent28`) is matched to that list (e.g. E4 → Engine 4). Unmatched units (e.g. private ambulance not in fleet) are **not** added to the incident.
- No separate apparatus list for parsing; validation is against Department Details only.

---

## 5. Incomplete parsing and duplicate incidents

- **Missing required fields:** For now, **create the incident with fields blank** (Option A). Option **C is a strong future improvement:** create as draft and require an admin to fill required fields before the incident is “complete” (or before it appears in the main queue).
- **Multiple emails for the same incident:** Dispatch may send several emails for one call. We must **not** create multiple incidents and force the user to delete duplicates. Design must support:
  - **One email → one incident** when it’s a new call.
  - **Multiple emails → one incident** when they refer to the same call (e.g. updates). Deduplication strategy (e.g. by incident number, CAD ID, or time window) to be defined during build; likely need a “link this email to existing incident” or “this email updates incident X” path.

---

## 6. Permissions

| Action | Allowed role |
|--------|----------------|
| **View** raw incoming CAD emails (Parsing Data) | Subadmin and above |
| **Edit** parsing rules | Subadmin and above |
| **Create / approve** (incidents, including auto-created) | User and above |

So: only subadmin+ see raw emails and parsing config; all users (and above) can create/approve incidents.

---

## 7. One email = one incident; multiple emails may map to one incident

- **One email** must not create **two** incidents.
- **Two (or more) emails** may relate to **one** incident (updates from dispatch). Logic to associate an incoming email with an existing incident (and update it instead of creating a new one) is part of the build; ties back to #5 (dedupe / “same incident” detection).

---

## 8. Auto-created incident state and UX

- Auto-created incidents start as **Draft**. Flow is not the same as NERIS validation/export locking (Phase 3); that applies to the NERIS report, not the incident record itself.
- **Badge:** Show a clear badge/icon immediately after the **Incident #** to indicate “created from CAD email” (for auditing and clarity).

---

## 9. Call sequencing (optional)

- **Option:** A checkbox or setting to enable **call sequencing**.  
  Example: last user-entered Incident Number was `2026-0005`; the next call in the queue (or next email-triggered incident) gets `2026-0006`, etc.
- Sequencing may be per tenant and/or per queue; exact rules (who can set it, where it’s configured) to be defined in build.

---

## 10. Summary table

| Topic | Decision |
|-------|----------|
| Email source | Single dispatch system per tenant; formats vary |
| Parsing config | Per tenant; department sets up (not program owner) |
| Rule types (order) | A (predefined labels) → C (pattern/regex) → B (highlight & assign) |
| Rule model | Stackable: “Between Nth and Mth [delimiter]” → field; delimiters and positions in dropdowns |
| Apparatus | From Department Details only; unmatched units not added |
| Missing fields | Create incident with blanks (A); C = draft + require completion (strong later option) |
| Duplicates | Multiple emails may = one incident; dedupe strategy required |
| View raw / edit parsing | Subadmin+ |
| Create/approve incidents | User+ |
| Auto-created state | Draft; badge after Incident # for “from CAD” |
| Call sequencing | Optional; enable setting; 2026-0005 → 2026-0006 style |

---

## 11. References

- **Existing:** `CadEmailIngest` table; POST `/api/cad/inbound-email`; Worker sends to API. GET `/api/cad/emails` (tenant-scoped list for UI). Emails are stored; viewing UI is implemented.
- **Where it lives in app:** Admin Functions → **Dispatch Parsing Settings** (view incoming emails). Parsing Data / rules and auto-create to be added.
- **After this:** In-depth technical design (data model for parsing rules, dedupe logic, sequencing, API, and UI) before full parsing module.

---

*Doc created from planning Q&A. Update as design and build progress.*
