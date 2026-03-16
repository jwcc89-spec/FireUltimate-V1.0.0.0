# Active Context Snapshot (menu-submenu/ui-updates)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`; tenant is resolved from request host (or demo on localhost).
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.

## Current branch
- `menu-submenu/ui-updates`

## Current focus
- General UI future changes (L1–L4 done; L5–L7 deferred until after test).

## Latest known status
- L1–L4 implemented (login cleanup, tenant logo on login, Scaffolded→Beta, super admin staging-only). Changes not yet committed; ready for test then commit.

## Current blocker / status
- None. User to test L1–L4, then commit + push; then proceed with L5–L7 (beta sections clickable only for super admin).

## External dependency status
- 

## Recent key commits (latest first)
- `3489f77` ACTIVE_CONTEXT: latest commit fe6f0ec
- `fe6f0ec` Handoff: record commit 9098265 and push to origin
- `9098265` Bootstrap handoff for menu-submenu/ui-updates (QUICK_PROMPTS flow)

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md` (if present).
2. **Do now:** Read this file and the latest note in `agent-handoffs/branches/menu-submenu--ui-updates/sessions/`.
3. When touching architecture, data, or integrations: read `docs/system_architecture.md`, `docs/data_model.md`, `docs/agent-execution-contract.md`; for incident/report/export: `docs/incident-lifecycle.md`; for CAD/NERIS/NEMSIS: `docs/integrations.md`.
4. Confirm branch with user and continue from current blocker only.
5. Give clear **do this now** vs **do this later** directions and step-by-step instructions.
