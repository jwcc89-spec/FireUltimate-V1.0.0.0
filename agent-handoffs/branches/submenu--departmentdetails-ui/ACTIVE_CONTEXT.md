# Active Context Snapshot (submenu/departmentdetails-ui)

## Current branch
- `submenu/departmentdetails-ui`

## Current focus
- Task 2 multi-tenant: Wave 6 closed; next phase is Wave 7 (DEMO safety controls), then Wave 8 full validation.

## Latest known status
- Staging backend deploy is live on Render and now binds `PORT` correctly.
- Tenant-domain routing is validated end-to-end:
  - `demo.staging.fireultimate.app` -> `demo`
  - `cifpdil.staging.fireultimate.app` -> `cifpdil`
- Frontend can be served by proxy from `dist` (root route support) when Render build includes `npm run build`.
- `docs/wave-6-domain-routing-runbook.md` now includes a required frontend stability hardening gate (deep-route refresh, static assets, `/api/*` verification).
- User confirmed the Wave 6 stability gate checklist was completed on both staging tenant hosts.
- `docs/task-2-multitenant-domain-plan.md` updated: Phase 6 status marked done.
- Lint: passing.

## Current blocker / status
- No blocker reported.
- Pending user decision for Wave 7 scope:
  - Option A: keep DEMO fully editable persistent sandbox (documentation-only closeout).
  - Option B: add DEMO-only restrictions for selected sensitive/admin actions.

## External dependency status
- Render service/environment is now the main external dependency for staging validation.
- Frontend staging as a separate Render web service remains deferred by plan unless user chooses to pull it forward.

## Recent key commits (latest first)
- `5ed1b5a` Serve built frontend from proxy for staging root routes
- `601c53e` Fix Render startup: env fallback, PORT binding, Prisma client generation
- `6ea23bc` Fix Render startup env handlin & PORT binding, complete phase 3,4,5
- `94dab6e` Added full conversation

## Next agent should do this first
1. Read `cursoragent-context.md`, this file, `docs/agent-execution-contract.md`, `docs/task-2-multitenant-domain-plan.md`, and the latest session note.
2. Confirm whether Wave 7 is Option A (no new restrictions) or Option B (implement DEMO restrictions).
3. If implementing Wave 7 behavior changes, keep tenant scoping explicit and run `npm run lint` plus targeted route checks.
4. Continue to Wave 8 verification checklist after Wave 7 closes.
