# Canvas plans

Canvas plans are the standard planning format for FireUltimate (decided 2026-10-29). Each plan is a Cursor canvas that shows stages, steps, status, decisions, and data-safety rules. This folder keeps a copy of each canvas's source so the plan is versioned with the code.

The canvas link is the live view. The `.canvas.tsx` file here is a backup copy. It only displays inside Cursor and is not part of the app build (it is excluded from lint and TypeScript).

| Plan | Status | Canvas | Repo copy |
|------|--------|--------|-----------|
| Fire Ultimate — Beginner Repair Plan (Fire Recovery, then CAD) | Stage B is on staging as of 2026-11-01. Stage C Waves 1–3 are on the practice branch only. Production is not updated. The live canvas was not republished; trust the repo copy. | [Open canvas](https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136) | `repair-plan.canvas.tsx` |
| Fire Ultimate — Secure sessions and access controls design (Steps 5–6) | Older design. Steps 5 and 6 are included in the 2026-11-01 staging deploy. This canvas was not republished. | [Open canvas](https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/a9d0e635-88a9-45c5-89c8-ab93873f7618) | `step-5-6-secure-sessions-design.canvas.tsx` |
| Scheduling — weekday 12-hour department test (branch `cursor/watseka-scheduling-plan`) | Active — session ended November 4, 2026, about 1:00 a.m. Chicago. Stage A done. Stage D passed locally. Next build is Step 3 (selected weekdays), waiting on layout approval | [Open canvas](https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/07bcb2d0-f8d5-448e-9b16-a5473b749ecc) (canvas id `07bcb2d0-f8d5-448e-9b16-a5473b749ecc`) | `weekday-schedule-test-plan.canvas.tsx` |

## Rules for agents
See `.cursor/rules/planning-canvas.mdc`. In short: update the canvas whenever a step or decision changes, then copy the full source into this folder and commit it.
