# Narrative Builder and Reporting UI — Plan (PRIORITY 11.1)

**Reference:** PRIORITY 11.1 — Narrative Builder (guided narrative composition).  
**Scope:** Admin “Report | NERIS” → “Reporting” with side-menu layout; Narrative Builder admin module; enable/disable; NERIS report form integration.

---

## Overview

1. **Phase 1:** Rename submenu to “Reporting,” give it a NERIS-form–style side menu; first module = “NERIS Required Fields” (current content; styling only).
2. **Phase 2:** Second side-menu module = “Narrative Builder” — admin creates fillable templates (admin fillable, NERIS fields, user fillable); preview; end-user selection populates narrative (see follow-up questions below).
3. **Phase 3:** “Enable Narrative Builder” at top of Narrative Builder module; when enabled, Narrative Builder is visible in the NERIS report form.
4. **Phase 4:** Reorder NERIS report form modules (Narrative below Resources); add “Use Narrative Builder” (RL styling) in Narrative module; popup opens Narrative Builder; template selection populates Narrative field (editable, like copy/paste).

**Constraints:** No change to how NERIS Required Fields content populates (Phase 1). Tenant isolation and execution contract apply. Work in small batches; verify after each phase.

---

## Phase 1 — Reporting submenu + side menu (styling only)

### Goal

- Change Admin Functions submenu label from **“Reports | NERIS”** to **“Reporting”.**
- The Reporting page should look like the NERIS report form: **side menu bar** with sub-submenus/modules (not cards).
- **First side-menu item:** “NERIS Required Fields” — contains all content currently at Report | NERIS. Do **not** change how that content is loaded or how the form behaves; only layout/styling.

### Implementation notes

- **Menu:** In `appData.ts`, change submenu `label` from `"Reports | NERIS"` to `"Reporting"`; path can stay `/admin-functions/reports/neris` or move to e.g. `/admin-functions/reporting` (and add child routes for modules).
- **Layout:** New Reporting layout component with a left **side menu** (same visual pattern as NERIS report form sections). First item = “NERIS Required Fields”; clicking it shows the current NERIS Required Fields admin content in the main area.
- **Routing:** Either single route with hash/subroute (e.g. `#required-fields`) or nested routes (e.g. `/admin-functions/reporting`, `/admin-functions/reporting/required-fields`, `/admin-functions/reporting/narrative-builder`). Plan suggests nested routes so Phase 2 can add Narrative Builder as second module without redoing Phase 1.
- **No behavior change** for required-field checkboxes, save, or API.

### Acceptance criteria

- [x] Admin sidebar shows “Reporting” (not “Reports | NERIS”).
- [x] Clicking Reporting opens a page with a side menu (same style as NERIS form).
- [x] First side-menu item is “NERIS Required Fields”; its content matches current Report | NERIS (same fields, same save behavior).
- [x] Commit and push after Phase 1 for user testing.

### Phase 1 implementation (done)

- **appData.ts:** Submenu label changed to “Reporting”, path to `/admin-functions/reporting`.
- **App.tsx:** `ReportingAdminPage` added with side bar (`.neris-sidebar` / `.neris-section-nav`) and first module “NERIS Required Fields”; route `/admin-functions/reporting` renders it; `/admin-functions/reports/neris` redirects to `/admin-functions/reporting`.
- **App.css:** `.reporting-admin-root`, `.reporting-admin-layout`, `.reporting-admin-content` for layout; inner `.page-section` in content unstyled to avoid double panel.

---

## Phase 2 — Narrative Builder module (admin templates)

### Goal

- Second side-menu item under Reporting: **“Narrative Builder”.**
- Admin can **add new template.** For each template, admin builds a sequence of:
  - **Fillable text box** (admin enters fixed text, e.g. “On” or “all KFD units were dispatched to”).
  - **NERIS field** (e.g. `incident.onset.date`, `dispatch.location`) — inserted as a placeholder that will be replaced by the current form value when the template is used.
  - **User fillable text box** — empty slot the end user fills in when using the template.
- Admin enters values for the **admin** fillable text boxes; NERIS field placeholders and user fillable slots are not “filled” by admin.
- **Preview** in the same view: show how the narrative will look when rendered (e.g. “On &lt;incident.onset.date&gt; all KFD units were dispatched to &lt;dispatch.location&gt; &lt;user fillable&gt;” or with sample values).
- When the **end user** selects this template in the NERIS report form (Phase 4), the narrative field is populated: NERIS placeholders replaced by current form values, admin text as-is, user fillable slots left for the user to type (or pre-filled if we support default text).

### Follow-up questions (before implementing Phase 2) — answered

1. **Template naming and list:** Each template has a **name**, **required** and entered by the admin on creation. **Storage recommendation:** store templates in **Department Details** (tenant-scoped). Add a top-level key e.g. `narrativeTemplates: NarrativeTemplate[]` in the payload sent to `GET/POST /api/department-details`. Same API and tenant isolation as other admin config (e.g. `nerisRequiredFieldOverrides`); no Prisma schema change. If the list grows very large later, a dedicated table can be added. **End user:** sees template **names** in a dropdown/list; after selecting one, sees a **preview** of the narrative, then clicks **“Use Template”** to apply.

2. **Which NERIS fields:** Admin can pick from **all** NERIS form fields. The **same field can appear more than once** in one template.

3. **User fillable:** Always a **single free-text slot per occurrence**. Admin can **optionally** add a **placeholder hint** for that slot (e.g. “Describe conditions on arrival”).

4. **Preview and placeholders:** **Admin preview:** NERIS placeholders show as **human-readable labels** (e.g. “Incident onset date”). **End-user preview:** User-fillable areas are shown as **value entry boxes** that can be **filled before** clicking “Use Template”; then the composed text (with those values and NERIS values) is inserted into the Narrative field.

5. **Ordering and editing:** Admin can **reorder segments** (e.g. drag to move). Admin can **edit** and **delete** existing templates.

### Phase 2 implementation notes (from answers)

- **Storage:** `narrativeTemplates` in Department Details payload (tenant-scoped). Shape: `Array<{ id: string; name: string; segments: Segment[]; createdAt?: string }>`. Persist via existing `GET/POST /api/department-details`; merge with existing payload on POST (no overwrite of other keys).
- **Segment types:** `"fillable"` (admin-entered fixed text), `"neris"` (NERIS field id, e.g. `incident.onset.date`), `"userFillable"` (optional `placeholderHint?: string`), `"question"` (admin-entered question text + 2+ answer/response rows; end user selects an answer from dropdown and the matching response text is inserted into the narrative).
- **Admin UI:** Add template (name required). Build template by adding segments in order; for each segment type: fillable text, or pick NERIS field (all form fields), or user fillable (optional hint). Preview shows human-readable labels for NERIS segments and fixed text; user-fillable shown as placeholders. Edit/delete/reorder templates.
- **End-user (Phase 4 popup):** Dropdown/list of template names → select one → preview with NERIS values resolved and user-fillable areas as **value entry boxes** → user can type into those boxes → “Use Template” builds final narrative and inserts into Narrative field (editable after).

### Phase 2 implementation (done)

- **Storage:** `narrativeTemplates` in Department Details payload; load/save via `GET/POST /api/department-details`; localStorage updated after save (same pattern as NERIS required fields).
- **New file:** `src/pages/NarrativeBuilderAdminPage.tsx` — types `NarrativeSegment`, `NarrativeTemplate`; CRUD (add with required name, edit, delete); segment builder (fillable text, NERIS field picker from all `NERIS_FORM_FIELDS`, user fillable with optional hint, and question segments with answer/response rows); reorder via Up/Down buttons; admin preview with human-readable NERIS labels.
- **App.tsx:** Second Reporting module “Narrative Builder”; renders `NarrativeBuilderAdminPage` when selected.
- **App.css:** Styles for `.narrative-builder-admin`, `.segment-builder`, `.segment-list`, `.segment-tag`, preview, etc.

---

## Phase 3 — Enable Narrative Builder

### Goal

- When the **Narrative Builder** side-menu module is selected, at the **top** of the content area show a control: **“Enable Narrative Builder”.**
- If **enabled**, the Narrative Builder feature is visible in the NERIS report form (Phase 4). If **disabled**, the “Use Narrative Builder” entry in the NERIS form is hidden or inactive.
- Storage: likely a flag in Department Details (e.g. `narrativeBuilderEnabled: boolean`) so it’s per-tenant.

### Acceptance criteria

- [x] Toggle “Enable Narrative Builder” in Admin → Reporting → Narrative Builder.
- [ ] When enabled, NERIS report form shows “Use Narrative Builder” (Phase 4); when disabled, it does not (or is not clickable).

### Phase 3 implementation (done)

- **Storage:** `narrativeBuilderEnabled` (boolean) in Department Details payload; loaded with narrative templates, saved when user clicks Save.
- **UI:** At the top of the Narrative Builder module, an “Enable Narrative Builder” checkbox with short hint. Toggling updates local state; “Click Save to persist.” shown until user saves.
- **Phase 4** will read this flag to show or hide “Use Narrative Builder” in the NERIS report form.

---

## Phase 4 — NERIS report form: Narrative order + “Use Narrative Builder”

### Goal

- **Reorder** NERIS report form modules so **Narrative** appears **below Resources** in the side menu.
- Inside the **Narrative** module, next to the word “Narrative,” add a **“Use Narrative Builder”** control — styled as **RL** (Reveal Link; see cursoragent-context / project UI patterns).
- Clicking “Use Narrative Builder” opens a **popup/modal** with the Narrative Builder (list of templates; user selects one).
- When the user **selects a template**, the narrative text is **inserted into the Narrative field** (editable), i.e. like a copy-paste: NERIS placeholders replaced by current form values, user fillable slots as empty or placeholder; user can still edit the full text afterward.

### Implementation notes

- **Section order:** In `nerisMetadata.ts` (or wherever NERIS form sections are defined), change order so Narrative comes after Resources.
- **RL styling:** Use existing Reveal Link pattern (blue clickable; toggles or opens action). Here it “opens” the builder popup.
- **Popup:** Modal or slide-over that lists templates (when Narrative Builder is enabled and templates exist). On “Apply” or template click, build the narrative string from template + current form values + empty user slots, then set Narrative field value and close popup.
- **Enable gate:** Show “Use Narrative Builder” only when Phase 3’s “Enable Narrative Builder” is true (read from Department Details or same config).

### Acceptance criteria

- [x] Narrative module is below Resources in the NERIS form side menu.
- [x] “Use Narrative Builder” appears next to “Narrative” (RL style); only when Narrative Builder is enabled.
- [x] Clicking it opens a popup with template list; selecting a template fills the Narrative field (editable after).
- [x] NERIS field placeholders in template are replaced by current form values; user fillable slots are empty or marked for user input.

### Phase 4 implementation (done)

- **Section order:** `nerisMetadata.ts` — Narrative moved to appear after Resources in `NERIS_FORM_SECTIONS`.
- **Shared module:** `src/narrativeBuilder.ts` — types `NarrativeSegment`, `NarrativeTemplate` and `buildNarrativeFromTemplate()` for use by admin page and NERIS form.
- **App.tsx:** `readNarrativeBuilderEnabledFromDraft()`, `readNarrativeTemplatesFromDraft()`; pass `narrativeBuilderEnabled` and `narrativeTemplates` into `NerisReportFormPage` (and route props interface).
- **NerisReportFormPage:** New props `narrativeBuilderEnabled`, `narrativeTemplates`. When Narrative section is active and enabled and templates exist, show “Use Narrative Builder” (`.neris-rl-link`) next to the section heading. Click opens modal: template list → select template → preview with NERIS values from form and input boxes for user-fillable slots → “Use Template” builds text via `buildNarrativeFromTemplate()`, sets `narrative_outcome` with `updateFieldValue()`, closes modal. Narrative field remains editable.
- **CSS:** `.neris-rl-link`, `.neris-narrative-builder-modal-overlay`, `.neris-narrative-builder-modal`, template list, preview with inline user-slot inputs, modal actions.

---

## Execution order

1. **Phase 1** — Implement; commit and push for testing (no Phase 2/3/4 yet).
2. **Phase 2** — Resolve follow-up questions; then implement Narrative Builder admin module and template CRUD/preview.
3. **Phase 3** — Add “Enable Narrative Builder” and wire to visibility in NERIS form.
4. **Phase 4** — Reorder Narrative below Resources; add “Use Narrative Builder” RL and popup; wire template selection to Narrative field.

---

## References

- PRIORITY 11.1 (`docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md`)
- UI patterns: `cursoragent-context.md` (RL, DD-S, etc.), `.cursor/project-context.md`
- NERIS form sections: `src/nerisMetadata.ts` (`NERIS_FORM_SECTIONS`, etc.)
- Admin menu: `src/appData.ts` (Admin Functions submenus)
- Execution contract: `docs/agent-execution-contract.md`
