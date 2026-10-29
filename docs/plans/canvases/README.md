# Canvas plans

Canvas plans are the standard planning format for FireUltimate (decided 2026-10-29). Each plan is a Cursor canvas that shows stages, steps, status, decisions, and data-safety rules. This folder keeps a copy of each canvas's source so the plan is versioned with the code.

The canvas link is the live view. The `.canvas.tsx` file here is a backup copy. It only displays inside Cursor and is not part of the app build (it is excluded from lint and TypeScript).

| Plan | Status | Canvas | Repo copy |
|------|--------|--------|-----------|
| Fire Ultimate — Beginner Repair Plan (Fire Recovery, then CAD) | Active — Steps 1–4 done, Step 5 next | [Open canvas](https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136) | `repair-plan.canvas.tsx` |

## Rules for agents
See `.cursor/rules/planning-canvas.mdc`. In short: update the canvas whenever a step or decision changes, then copy the full source into this folder and commit it.
