# Cursor Agent Context Rules

## 1) Mandatory opening question
1. At the start of every new session, the agent must ask:
   **"Which branch am I working on?"**
2. The user's response defines the active branch for the session.
3. The agent must stay on that branch unless the user explicitly tells it to switch.

## 2) Communication style (beginner-friendly)
4. Assume the user is new to coding; explain in plain language.
5. Always provide clear step-by-step testing instructions after changes.
6. For terminal commands, explain:
   - what each command does,
   - why it is needed,
   - what success/failure output should look like.
7. Keep guidance practical and concise unless user asks for deeper detail.
8. If requirements are unclear or conflicting, ask before assuming.

## 3) Branch and git discipline
9. Stay on the user-confirmed branch from the opening question.
10. Do not switch branches silently.
11. If a commit is made on the wrong branch, cherry-pick it to the user-confirmed branch and clearly report what happened.
12. Before asking the user to test, commit and push relevant changes.
13. Always report branch name and commit hash in completion notes.

## 4) Behavior and quality expectations
14. Keep UI changes aligned to screenshots and/or user-described layout.
15. If something appears broken or inconsistent, prioritize fixing behavior/functionality first, then styling.
16. Validate after changes (build/test) and report results clearly.
17. If requirements conflict, ask/confirm before making assumptions.

## 5) UI system/pattern rules
18. Use approved UI pattern naming consistently:
   - DD-S, DD-M, DD-GS, DD-GM
   - RL
   - RO-BOX
   - SEC-H
   - PILL
   - QC
   - plus newer patterns (UB-CARD, STAT-CHIP, TIME-EDIT, PRS-EMPTY, RL-BOX, FL, etc.).
19. Prefer custom dropdown components over native HTML `<select>` for consistent styling.
20. PILL behavior must support toggle-off (click selected option again to deselect).

## 6) Workflow/testing expectations
21. Run lint/build checks after edits when possible.
22. Provide copy/paste test checklists.
23. If errors occur, request full (not truncated) error output.
24. If issue is external (e.g., vendor/API permissions), say so explicitly and provide support-ready summary text.

## 7) Product constraints/preferences
25. Keep role model simple for now: Admin + User.
26. Continue UI buildout in parallel with API integration.
27. Use server-side proxy/security best practices (avoid exposing secrets in frontend).
28. If a proposed task is likely unrelated to the current error, state that clearly and recommend best route.

## 8) User environment constraints
29. Prefer instructions compatible with locked-down/work environments (no admin rights assumed).
30. Provide fallback command alternatives if a command fails.

## 9) Cross-agent continuity
31. At session start, read:
   - `agent-handoffs/ACTIVE_CONTEXT.md`
   - latest relevant file in `agent-handoffs/sessions/`
32. Before ending session:
   - update `agent-handoffs/ACTIVE_CONTEXT.md`
   - add/update a time-stamped note in `agent-handoffs/sessions/`
33. Include branch, commit hash, blockers, and exact next actions in every handoff.
