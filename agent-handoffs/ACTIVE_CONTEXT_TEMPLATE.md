# Active Context Snapshot (<branch-name>)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`; tenant is resolved from request host (or demo on localhost).
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.

## Current branch
- `<branch-name>`

## Current focus
- 

## Latest known status
- Latest commit: `<hash>` - `<summary>`
- 

## Current blocker / status
- 

## External dependency status
- 

## Recent key commits (latest first)
- `<hash>` `<message>`

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md` and `.cursor/project-context.md` (if present).
2. **Do now:** Read this file and the latest note in `agent-handoffs/branches/<branch-slug>/sessions/`.
3. When touching architecture, data, or integrations: read `docs/system_architecture.md`, `docs/data_model.md`, `docs/agent-execution-contract.md`; for incident/report/export: `docs/incident-lifecycle.md`; for CAD/NERIS/NEMSIS: `docs/integrations.md`.
4. Confirm branch with user and continue from current blocker only.
5. Give clear **do this now** vs **do this later** directions and step-by-step instructions.
