# Active Context Snapshot (menu-submenu/ui-updates)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`; tenant is resolved from request host (or demo on localhost).
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.

## Current branch
- `menu-submenu/ui-updates`

## Current focus
- General UI (L1–L7) and login/brand work completed this session. Branch ready for PR or merge.

## Latest known status
- **Latest commit:** `b98f695` — General UI (L1–L7): login cleanup, brand assets, superadmin + beta behavior.
- L1–L7 done: login cleanup (no department field, minimal text), tenant logo on login and in form header, composite brand image (left), Sign In To {tenantName}, Scaffolded→Beta, super admin role + staging-only visibility in dropdown, beta sidebar/cards clickable only for super admin. Server login returns userType from Department Details so "Super Admin" maps to superadmin.

## Current blocker / status
- None.

## External dependency status
- Brand assets in `public/`: `fire-ultimate-icon-wordmark-featureLine.png` (left panel); tenant logo from Department Details (right header when set).

## Recent key commits (latest first)
- `b98f695` General UI (L1–L7): login cleanup, brand assets, superadmin + beta behavior
- `9da9b0c` Merge pull request #18 from jwcc89-spec/submenu/neris-golive-cifpd
- (earlier bootstrap/handoff commits)

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md` (if present).
2. **Do now:** Read this file and the latest note in `agent-handoffs/branches/menu-submenu--ui-updates/sessions/`.
3. When touching architecture, data, or integrations: read `docs/system_architecture.md`, `docs/data_model.md`, `docs/agent-execution-contract.md`; for incident/report/export: `docs/incident-lifecycle.md`; for CAD/NERIS/NEMSIS: `docs/integrations.md`.
4. Confirm branch with user and continue from current blocker only.
5. Give clear **do this now** vs **do this later** directions and step-by-step instructions.
