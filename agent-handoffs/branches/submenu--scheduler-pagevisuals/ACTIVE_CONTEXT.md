# Active Context Snapshot (submenu/scheduler-pagevisuals)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`; tenant is resolved from request host (or demo on localhost).
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.

## Current branch
- `submenu/scheduler-pagevisuals`

## Current focus
- Personnel Schedule visual mockup pass, one piece at a time (canvas plan).

## Latest known status
- Latest commit at branch tip when work started: `6efda0e` - Merge pull request #37 from jwcc89-spec/submenu/neris-golive-cifpd
- Steps 0–6 + 8–13 + 15–16 done on disk (not committed yet unless user asked). Step 7 deferred. Step 14 reverted.
- Step 16 = Info/Trades coverage lines as soft pill chips.
- Inline seat select assign is pre-existing (staging/prod); parked for after visual pass.
- Blue day highlight decision: default is real calendar today.

## Current blocker / status
- Steps 18A–18D done November 5: week/month view + left label pills.
- Parked later: admin label colors/icons; Injury/Sick row forces red person pills.
- Next after your click-check: Step 17 KPI formulas, then cards.
- Week is Sunday–Saturday, hides non-shift days, default week. Calendar icon toggles week/month.

## External dependency status
- None.

## Recent key commits (latest first)
- `6efda0e` Merge pull request #37 from jwcc89-spec/submenu/neris-golive-cifpd

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md`.
2. **Do now:** Open [schedule-visual-mockup-plan.canvas.tsx](/Users/jeremywichtner/.cursor/projects/Users-jeremywichtner-CursorProjects-FireUltimate-V1-0-0-0/canvases/schedule-visual-mockup-plan.canvas.tsx) and start from the step marked **Next**.
3. Stay on `submenu/scheduler-pagevisuals`. One visual piece per step. No schema/auth/trade logic.
4. After each step: `npm run lint`; if TSX changed, `npm run build`; wait for user approval.
