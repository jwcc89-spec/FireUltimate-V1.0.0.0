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

### Follow-up questions (before implementing Phase 2)

1. **Template naming and list:** Should each template have a **name** (e.g. “Standard dispatch narrative”) that the end user sees in a dropdown/list when choosing a template? Where should the list of templates be stored (e.g. Department Details payload, new API, or existing config)?

2. **Which NERIS fields are allowed in templates?** Should the admin pick from **all** NERIS form fields (e.g. from `nerisMetadata`), or only a curated list (e.g. Core + Incident Times + Location)? Can the same NERIS field appear more than once in one template?

3. **User fillable behavior:** For “user fillable text box” — is it always a single free-text slot per occurrence, or do you want options (e.g. short vs long, or optional placeholder hint text like “Describe conditions on arrival”)? When the user applies the template, should multiple “user fillable” slots appear as separate blanks in the narrative or one combined area?

4. **Preview and placeholders:** In the admin preview, should NERIS placeholders show as human-readable labels (e.g. “Incident onset date”) or as the field key (e.g. `incident.onset.date`)? When the end user sees the populated narrative, should any remaining “user fillable” areas be visually marked (e.g. underlined or [Type here])?

5. **Ordering and editing:** Can the admin reorder segments (e.g. drag to move a NERIS field after a fillable text)? Can they edit or delete an existing template, or only add new ones?

(Implementer: use answers to these to define data shape, UI for “add segment,” and preview logic before coding Phase 2.)

---

## Phase 3 — Enable Narrative Builder

### Goal

- When the **Narrative Builder** side-menu module is selected, at the **top** of the content area show a control: **“Enable Narrative Builder”.**
- If **enabled**, the Narrative Builder feature is visible in the NERIS report form (Phase 4). If **disabled**, the “Use Narrative Builder” entry in the NERIS form is hidden or inactive.
- Storage: likely a flag in Department Details (e.g. `narrativeBuilderEnabled: boolean`) so it’s per-tenant.

### Acceptance criteria

- [ ] Toggle “Enable Narrative Builder” in Admin → Reporting → Narrative Builder.
- [ ] When enabled, NERIS report form shows “Use Narrative Builder” (Phase 4); when disabled, it does not (or is not clickable).

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

- [ ] Narrative module is below Resources in the NERIS form side menu.
- [ ] “Use Narrative Builder” appears next to “Narrative” (RL style); only when Narrative Builder is enabled.
- [ ] Clicking it opens a popup with template list; selecting a template fills the Narrative field (editable after).
- [ ] NERIS field placeholders in template are replaced by current form values; user fillable slots are empty or marked for user input.

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
