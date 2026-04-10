# Cursor Agent Context Rules

## 1) Mandatory opening question
1. At the start of every new session, the agent must ask:
   **"Which branch am I working on?"**
2. The user's response defines the active branch for the session.
3. The agent must stay on that branch unless the user explicitly tells it to switch.

## 2) Branch-specific handoff policy
4. All handoff notes must be branch-scoped.
5. Branch handoff root path format:
   - `agent-handoffs/branches/<branch-slug>/`
6. Branch slug rule:
   - replace `/` with `--`
   - Example: `submenu/neris-ui` -> `submenu--neris-ui`
7. Each branch folder should contain:
   - `ACTIVE_CONTEXT.md`
   - `sessions/` (timestamped notes)
   - optional `QUICK_PROMPTS.md` for hardcoded branch prompts
8. Agents should not update another branch's handoff folder unless explicitly asked.
9. If the branch handoff folder does not exist yet, create it before feature work:
   - create `agent-handoffs/branches/<branch-slug>/`
   - create `agent-handoffs/branches/<branch-slug>/sessions/`
   - create `ACTIVE_CONTEXT.md` from `agent-handoffs/ACTIVE_CONTEXT_TEMPLATE.md`
   - create first session note from `agent-handoffs/HANDOFF_TEMPLATE.md`

## 3) Communication style (beginner-friendly)
10. Assume the user is new to coding; explain in plain language.
11. Always provide clear step-by-step testing instructions after changes.
12. For terminal commands, explain:
    - what each command does,
    - why it is needed,
    - what success/failure output should look like.
13. **Operator / test steps in chat (required whenever the user must do something):** If a response includes tests, verification, migrations, deploys, or any **actions the user must complete**, spell them out as **numbered steps** with:
    - **Where** to go (app screen path, e.g. *Admin Functions → …*, or *Render dashboard → …*);
    - **What to click** (button names, menu items, row expand);
    - **What to type or paste** — for **terminal**, give **exact copy-paste blocks**: full `cd` using the **absolute workspace path** when known (e.g. `cd /Users/…/FireUltimate-V1.0.0.0` then the full command on the next line). **Do not** say only “open the repo folder”, “go to project root”, or “cd to the project” without the **literal** `cd …` line and **literal** command.
    - **What they should see** if it worked (success message, log line, UI state).
    Optional pointer to **`docs/procedures/EMAIL_AND_CAD_SETUP.md`** for deep runbooks — but **chat instructions must stand alone** with exact commands.
    **Chat vs documentation files:** Telling the user what to run or click **in chat** (so they can test or unblock the next step) **does not** mean you must edit **`docs/plans/`**, **`EMAIL_AND_CAD_SETUP.md`**, or other docs. Update those only when the user asked for doc changes or when recording a lasting process change they requested.
    Same standard applies to **SQL** (which product, paste which query in full).
14. Keep guidance practical and concise unless user asks for deeper detail.
15. If requirements are unclear or conflicting, ask before assuming.
16. Before making non-trivial edits, provide a short preflight summary that explicitly lists:
    - task understanding,
    - constraints,
    - acceptance criteria,
    - risks.
17. When the preflight includes meaningful risk, the agent must ask for explicit user confirmation before editing.
18. In planning/execution updates, include quick callouts for:
    - risks vs rewards,
    - better/alternative implementation path when applicable,
    - related follow-up tasks in **Now vs Later** form.

## 4) Git discipline
19. Stay on the user-confirmed branch from the opening question.
20. Do not switch branches silently.
21. If a commit is made on the wrong branch, cherry-pick it to the user-confirmed branch and clearly report what happened.
22. Before asking the user to test, commit and push relevant changes.
23. Always report branch name and commit hash in completion notes.
24. Commit and push in small logical units.

## 5) Behavior and quality expectations
25. Keep UI changes aligned to screenshots and/or user-described layout.
26. If something appears broken or inconsistent, prioritize fixing behavior/functionality first, then styling.
27. Validate after changes (build/test) and report results clearly.
28. If requirements conflict, ask/confirm before making assumptions.

## 6) UI system/pattern rules
29. Use approved UI pattern naming consistently:
    - Core field styles:
      - `DD-S` = Dropdown Single (one value from flat list)
      - `DD-M` = Dropdown Multi (multiple values from flat list). **Implementation:** Use `NerisFlatMultiOptionSelect` for flat option lists (pill-style trigger, search, scrollable options panel). Use `NerisGroupedOptionSelect` with `mode="multi"` for grouped/categorical options. When DD-M or DD-S appears inside a modal or scrollable container, pass `usePortal` so the panel renders via `createPortal` into `document.body`—avoids clipping and prevents the container from expanding when the dropdown opens.
      - `DD-GS` = Dropdown Grouped Single (one value from grouped categories)
      - `DD-GM` = Dropdown Grouped Multi (multiple values from grouped categories)
      - `RL` = Reveal Link (blue clickable toggle for optional fields)
      - `QC` = Question Chips (2+ clickable option boxes)
      - `RO-BOX` = Read-Only Imported Box (gray, non-editable imported display)
      - `SEC-H` = Section Header (bold header style for major blocks)
      - `PILL` = Selected Value Pill (rounded selected-value visual)
    - Reusable workflow/layout styles:
      - `UB-CARD` = expandable bordered unit block card
      - `STAT-CHIP` = completion status chip
      - `CLICKABLE-LIST` = clickable table rows for collection selection (e.g. Edit Apparatus). Each row shows the primary identifier (e.g. Unit ID) in the first column and a grid of field values in the second column. Uses `clickable-row`, `clickable-row-selected`, `dispatch-info-cell`, and a collection-specific grid (e.g. `department-apparatus-grid-line`). Same styling as Incident Report Queue in NERIS Submenu. **Click-to-edit:** clicking a row immediately opens the entry/edit form (no separate Edit button click required). **Headers must be resizable** (drag the `|` separator between columns) and **reorderable** (Edit button opens field editor panel with drag handles to reorder columns), matching Incidents Submenu behavior.
      - `TIME-EDIT` = editable time panel
      - `PRS-EMPTY` = large gray empty-personnel state
      - `RL-BOX` = boxed reveal-link trigger
      - `FL` = field-list style used where applicable
      - `TH-SORT` = borderless clickable table header sort control with draggable column-resize handle and a 3-line tapered glyph (wide-to-narrow) indicating active sort and direction
    - If new reusable styles are created, agents must:
      1) propose short code,
      2) define it in one line,
      3) append it to this style dictionary immediately.
30. For collection editors (Edit Apparatus, Edit Stations, Edit Personnel): when selecting a single item to edit, use `CLICKABLE-LIST` instead of a dropdown—each unit/record in a separate row with all field values visible, styled like Incident Report Queue rows (`clickable-row`, `clickable-row-selected`, `dispatch-info-cell`, collection-specific grid). Row click must immediately open the entry/edit form (click-to-edit). Headers must support resizing (column resizer) and reordering (Edit button + drag-order list), matching Incidents Submenu.
31. Request/implementation mapping format must be:
    - `[Section] -> [Field] -> [Style Code] -> [Behavior notes]`
    - Example: `Location -> Place Type -> DD-S`
32. For `RL` behavior, keep clickable wording visible and toggle fields show/hide on repeated click.
33. Prefer custom dropdown components over native HTML `<select>` for consistent styling.
34. PILL behavior must support toggle-off (click selected option again to deselect).

## 7) Workflow/testing expectations
35. Run lint/build checks after edits when possible.
36. Provide copy/paste test checklists (with **where / click / type / expect** detail when the user runs them).
37. If errors occur, request full (not truncated) error output.
38. If issue is external (e.g., vendor/API permissions), say so explicitly and provide support-ready summary text.

## 8) Product constraints/preferences
39. Keep role model simple for now: Admin + User.
40. Continue UI buildout in parallel with API integration.
41. Use server-side proxy/security best practices (avoid exposing secrets in frontend).
42. If a proposed task is likely unrelated to the current error, state that clearly and recommend best route.
42a. **Time format:** All time inputs and displays use **24-hour (military)** format app-wide (no AM/PM). See `.cursor/project-context.md` § Time format. When adding or changing time fields, follow this convention.
42b. **NERIS print parity:** Any field, module, or custom data added to the NERIS report form must be included in the Print summary when it has a value. Agents must update print-summary logic alongside form changes so populated values are printable.
42c. **NERIS required-fields parity:** Any field, module, or custom data added to the NERIS report form must also be represented in **Admin Functions -> Reporting -> NERIS Required Fields** so admins can mark it required/not required. Agents must update metadata + required-field selection support whenever new NERIS form fields are added.

## 9) User environment constraints
43. Prefer instructions compatible with locked-down/work environments (no admin rights assumed).
44. Provide fallback command alternatives if a command fails.

## 10) Session handoff workflow
45. At session start, read:
    - this file
    - `.cursor/project-context.md` (when present — project-level constraints)
    - `agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md`
    - latest note in `agent-handoffs/branches/<branch-slug>/sessions/`
    - When touching architecture, data, or integrations: `docs/system_architecture.md`, `docs/data_model.md`, `docs/agent-execution-contract.md`; for incident/report/export flow: `docs/incident-lifecycle.md`; for external systems: `docs/integrations.md`.
46. Before ending session:
    - update branch `ACTIVE_CONTEXT.md`
    - add a new timestamped session note in that same branch folder
47. Standard startup/continuation prompts are in `agent-handoffs/QUICK_PROMPTS.md`:
    - Prompt #2 = new agent bootstrap flow
    - Prompt #3 = cloud continuation flow after Cursor work
48. Include branch, commit hash, blockers, and exact next actions in every handoff.
49. Always give clear direction: say what to **do now** vs what can be **done later**; use step-by-step instructions and **Now vs Later** callouts so the next agent (or user) knows the path.

## 11) Repository analysis before code
50. Before writing code for a task, do the following and wait for user confirmation before editing multiple files:
    1. **Identify impacted files** — List the files you expect to change or add.
    2. **Identify related modules** — Note any other parts of the app (e.g. API, UI, schema) that are related so nothing is missed.
    3. **Propose a short implementation plan** — A few steps: e.g. "Step 1: add field to schema; Step 2: update API; Step 3: update UI."
51. Wait for user confirmation before editing multiple files (unless the user has already approved the plan or a batch).
52. Keep communication beginner-friendly: explain each step in plain language, and give clear "do this now" vs "do this later" directions.
