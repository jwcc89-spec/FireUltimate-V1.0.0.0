# Active Context Snapshot (submenu/scheduler-pagevisuals)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`; tenant is resolved from request host (or demo on localhost).
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.

## Current branch
- `submenu/scheduler-pagevisuals`

## Current focus
- Personnel Schedule visual mockup plan is complete (November 5, 2026) and archived at `docs/completed/schedule-visual-mockup-plan.canvas.tsx`.

## Latest known status
- Latest commit at branch tip when work started: `6efda0e` - Merge pull request #37 from jwcc89-spec/submenu/neris-golive-cifpd
- Steps 0–6 + 8–13 + 15–16 done on disk (not committed yet unless user asked). Step 7 deferred. Step 14 reverted.
- Step 16 = Info/Trades coverage lines as soft pill chips.
- Inline seat select assign is pre-existing (staging/prod); parked for after visual pass.
- Blue day highlight decision: default is real calendar today.

## Current blocker / status
- Visual plan closed November 5, 2026. No next step on that plan.
- B9 phone layout is its own parked plan: `docs/plans/canvases/schedule-mobile-plan.canvas.tsx`. Do not start it unless asked.
- B11 qualification color palette is parked inside the archived visual plan. Do not start it unless asked.

## External dependency status
- None.

## Recent key commits (latest first)
- `6efda0e` Merge pull request #37 from jwcc89-spec/submenu/neris-golive-cifpd

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md`.
2. **Do not restart** the visual mockup plan. It is archived at `docs/completed/schedule-visual-mockup-plan.canvas.tsx`.
3. Stay on `submenu/scheduler-pagevisuals` unless the user names another branch.
4. Phone layout and the color palette stay parked until the user asks.
