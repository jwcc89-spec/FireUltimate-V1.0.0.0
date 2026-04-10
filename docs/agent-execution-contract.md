# Agent Execution Contract

Purpose: keep agent behavior consistent across model choices (including Auto) and reduce regression risk during Task 2 migration.

## 1) Mandatory Session Preflight
- Read `cursoragent-context.md`.
- Read `docs/task-2-multitenant-domain-plan.md`.
- Restate in writing:
  - exact request,
  - constraints,
  - acceptance criteria,
  - expected risks.

## 2) Change Control
- Use small, reviewable batches only.
- Do not continue to the next batch without user approval.
- Do not introduce unapproved architecture changes.

## 3) Multi-Tenant Safety
- Every modified API route must remain tenant-scoped.
- Never mix data between tenants.
- Keep tenant strategy explicit:
  - `demo` is persistent sandbox (no automatic reset).
  - trial tenants (for agencies) are isolated and persistent unless manually archived/reset.

## 4) Auth/Data Safety
- Use bcrypt hashing for password storage/verification.
- Use dedicated auth tables/endpoints for auth data.
- Do not store auth secrets in `DepartmentDetails.payloadJson`.

## 4.1) Data Integrity Protection
- Agents must **not** modify the Prisma schema, existing migration files, or authentication/authorization logic unless the user **explicitly approves**.
- If a task requires schema, migrations, or auth changes, state that clearly and wait for approval before proceeding.

## 5) Verification After Each Batch
- Run `npm run lint`.
- Run **`npm run build`** when changes touch app or server code (lint does not catch all build errors). Do this after each batch that could affect TypeScript, imports, or the server.
- Run targeted endpoint checks for changed behavior.
- Report what changed, what passed, and what still needs work.

## 6) Documentation + Handoff
- Update `docs/task-2-multitenant-domain-plan.md` when decisions change.
- Add "Now vs Later" callouts for deferred items.
- List blockers/assumptions explicitly.

## 7) Operator-facing steps in chat (mandatory when the user must act)
Whenever a response tells the user to **test**, **verify**, **migrate**, **deploy**, **run SQL**, or complete **any** operational step, include **numbered instructions** the user can follow without guessing:
- **Where** to work (e.g. app path *Admin Functions → …*, *Render → service → Logs*, *Neon → SQL Editor*).
- **What to click** (buttons, sidebar items, row expand).
- **What to paste** — for **shell**, include the **full** `cd` using the **absolute project path** when known, plus the **exact** command(s) on their own lines (copy-paste ready). Do **not** substitute vague “go to the repo folder” / “project root” without a literal `cd /path/to/project`.
- **What success looks like** (message text, HTTP status, UI state).
Optional link to **`docs/procedures/EMAIL_AND_CAD_SETUP.md`** for background; **chat steps must be complete by themselves**.

**Chat vs repo docs:** Instructions in chat so the user can **test or continue** do **not** require updating implementation plans or **`EMAIL_AND_CAD_SETUP.md`** unless the user explicitly asked to change those documents.

**Cursor agents:** mirror `cursoragent-context.md` § Communication style (item 13).
