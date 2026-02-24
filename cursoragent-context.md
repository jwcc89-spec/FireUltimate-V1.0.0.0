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
13. Keep guidance practical and concise unless user asks for deeper detail.
14. If requirements are unclear or conflicting, ask before assuming.

## 4) Git discipline
15. Stay on the user-confirmed branch from the opening question.
16. Do not switch branches silently.
17. If a commit is made on the wrong branch, cherry-pick it to the user-confirmed branch and clearly report what happened.
18. Before asking the user to test, commit and push relevant changes.
19. Always report branch name and commit hash in completion notes.
20. Commit and push in small logical units.

## 5) Behavior and quality expectations
21. Keep UI changes aligned to screenshots and/or user-described layout.
22. If something appears broken or inconsistent, prioritize fixing behavior/functionality first, then styling.
23. Validate after changes (build/test) and report results clearly.
24. If requirements conflict, ask/confirm before making assumptions.

## 6) UI system/pattern rules
25. Use approved UI pattern naming consistently:
    - Core field styles:
      - `DD-S` = Dropdown Single (one value from flat list)
      - `DD-M` = Dropdown Multi (multiple values from flat list)
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
      - `TIME-EDIT` = editable time panel
      - `PRS-EMPTY` = large gray empty-personnel state
      - `RL-BOX` = boxed reveal-link trigger
      - `FL` = field-list style used where applicable
    - If new reusable styles are created, agents must:
      1) propose short code,
      2) define it in one line,
      3) append it to this style dictionary immediately.
26. Request/implementation mapping format must be:
    - `[Section] -> [Field] -> [Style Code] -> [Behavior notes]`
    - Example: `Location -> Place Type -> DD-S`
27. For `RL` behavior, keep clickable wording visible and toggle fields show/hide on repeated click.
28. Prefer custom dropdown components over native HTML `<select>` for consistent styling.
29. PILL behavior must support toggle-off (click selected option again to deselect).

## 7) Workflow/testing expectations
30. Run lint/build checks after edits when possible.
31. Provide copy/paste test checklists.
32. If errors occur, request full (not truncated) error output.
33. If issue is external (e.g., vendor/API permissions), say so explicitly and provide support-ready summary text.

## 8) Product constraints/preferences
34. Keep role model simple for now: Admin + User.
35. Continue UI buildout in parallel with API integration.
36. Use server-side proxy/security best practices (avoid exposing secrets in frontend).
37. If a proposed task is likely unrelated to the current error, state that clearly and recommend best route.

## 9) User environment constraints
38. Prefer instructions compatible with locked-down/work environments (no admin rights assumed).
39. Provide fallback command alternatives if a command fails.

## 10) Session handoff workflow
40. At session start, read:
    - this file
    - `agent-handoffs/branches/<branch-slug>/ACTIVE_CONTEXT.md`
    - latest note in `agent-handoffs/branches/<branch-slug>/sessions/`
41. Before ending session:
    - update branch `ACTIVE_CONTEXT.md`
    - add a new timestamped session note in that same branch folder
42. Standard startup/continuation prompts are in `agent-handoffs/QUICK_PROMPTS.md`:
    - Prompt #2 = new agent bootstrap flow
    - Prompt #3 = cloud continuation flow after Cursor work
43. Include branch, commit hash, blockers, and exact next actions in every handoff.
