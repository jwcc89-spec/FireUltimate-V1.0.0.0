# CAD dispatch parsing — implementation plan (master)

**Branch:** `submenu/neris-golive-cifpd`  
**Status:** In progress (Batches A–B complete for secret enforcement + docs; Phase 2b allowlist pending)  
**Related:** Product goals and rule types — `docs/plans/CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md`  
**Runbooks:** `docs/procedures/EMAIL_AND_CAD_SETUP.md`

---

## How to update this document when work completes

Use Markdown strikethrough: `~~text~~` so it renders as ~~text~~.

1. When a **Phase** is fully done, strike through the **phase number and title** in the heading, e.g. `~~Phase 1 — …~~`.
2. When individual **bullets or table rows** inside a phase are done, strike through those lines only (leave the phase header until the whole phase is done).
3. When a **batch** row in the implementation batch table is done, strike through the **entire row** (all columns in that row).

**Agents:** After completing a phase or batch, update this file in the same commit or immediately after merge, then run `npm run lint` if you touched anything that could affect CI.

---

## Phase 0 — Decisions and constraints

| Topic | Decision |
|--------|-----------|
| Tenant scope | All parsing config, rules, allowlists, and flags are **per-tenant** (`tenantId`). |
| Incident identity | Merge/create key = **CAD/CFS incident number** extracted from message text (tenant-specific extraction rules). |
| When rules run | **(A)** Admin UI: **preview** while editing (no incident writes from typing alone). **(B)** **Save** persists config for the tenant. **(C)** On each **ingest**, server loads **saved** rules and runs them automatically — no manual step after setup. Same engine for preview and ingest. |
| End-user experience | Responders see **parsed outputs** (e.g. message text), not raw email or rule definitions. |
| Persistence | Config stays until an admin changes it; applies to **all users** on that tenant. **Dedicated DB table(s)** for parsing config and allowlist (plus existing `CadEmailIngest` for raw mail). **Prisma schema/migrations require explicit approval** before merge. |
| Time format | Parsed times use **24-hour `HH:MM:SS`**; dates consistent with app conventions. |
| Secrets | **`CAD_INGEST_SECRET` required** in production API env; Cloudflare Worker sends **`X-Cad-Ingest-Secret`** on every POST to `/api/cad/inbound-email`. **No secrets** in `DepartmentDetails.payloadJson` or parsing rule JSON. |
| Spam / abuse | **Allowlist / filtering** so junk does not become incidents or member messages (Worker and/or API — see Phase 2). |

---

## ~~Phase 1 — Information architecture and routes~~

1. ~~**Parent path:** `/admin-functions/dispatch-parsing-settings` → **redirect** default to **`/admin-functions/dispatch-parsing-settings/raw-email`** (unless product chooses another default later).~~
2. ~~**Left sidebar** (same layout as Department Details / Reporting: `reporting-admin-layout` + sidebar nav):~~

| Child | Route | Purpose |
|--------|--------|--------|
| ~~Message Parsing~~ | ~~`/admin-functions/dispatch-parsing-settings/message-parsing`~~ | ~~Rules + side-by-side preview → **parsed message** string (future member notifications). Placeholder page until Batch H.~~ |
| ~~Incident Parsing~~ | ~~`/admin-functions/dispatch-parsing-settings/incident-parsing`~~ | ~~Rules + field mapping + side-by-side **dispatch text vs parsed incident fields**; **Enable Incident Creation** at top of this page (or shared header). Placeholder page until Batch F.~~ |
| ~~Raw Email~~ | ~~`/admin-functions/dispatch-parsing-settings/raw-email`~~ | ~~Current behavior: list, expand row, plain/MIME/base64 for troubleshooting. (Nav order: third, below Incident Parsing.)~~ |

3. ~~**Legacy route:** Any old single URL for dispatch parsing → **redirect** into this tree (e.g. `raw-email`).~~
4. ~~**Admin menu:** Entry points at parent; sidebar lists the three children.~~

**~~Acceptance:~~** ~~All three routes render with sidebar; redirects work.~~ *(Batch A, 2026-04-09.)*

---

## Phase 2 — Security: secret and allowlist

### ~~2a — Secret (mandatory)~~ *(Batch B, 2026-04-09)*

- ~~Set **`CAD_INGEST_SECRET`** on API host (e.g. Render).~~
- ~~Set matching secret on **cad-email-ingest-worker**; Worker sends **`X-CAD-Ingest-Secret`**.~~
- ~~When **`NODE_ENV=production`**, API requires **`CAD_INGEST_SECRET`**; if unset → **503**; wrong/missing header → **401**.~~
- ~~Documented in **`docs/procedures/EMAIL_AND_CAD_SETUP.md`**, **Worker README**, **`.env.server.example`**, **`TENANT_ONBOARDING_CHECKLIST.md`**.~~

### 2b — Allowlist / spam filtering

- **Tenant-configurable allowlist** in DB (e.g. allowed **From** domains or patterns).
- **Worker (first line):** Optionally drop or do not POST if sender not allowed (reduces noise).
- **API (second line):** Re-check before storing/parsing/auto-incident as policy dictates.
- **Default posture:** Document whether **empty allowlist** means reject, quarantine-only row, or store-but-do-not-parse.
- **Admin UI:** Manage allowlist; optional “would this sender pass?” test.

**Acceptance:** ~~Secret required when `NODE_ENV=production`~~ *(done)*; allowlist behavior documented and testable on staging *(pending 2b)*.

---

## Phase 3 — Persistence model (dedicated tables)

Direction (exact columns in migration after explicit OK):

- Parsing config table(s): `tenantId`, flags (**Enable Incident Creation**, etc.), message vs incident rule sets, field map, incident-number extraction config.
- Allowlist table (or embedded in config): `tenantId`, allowed domains/patterns, enabled.
- Optional: `CadEmailIngest` status columns / indexes for list performance and quarantine filtering.

**Acceptance:** Migrations applied; tenant isolation on all reads/writes.

---

## Phase 4 — Rule engine (shared library)

1. Input: normalized **dispatch text** (reuse existing plain-text extraction where applicable).
2. Ordered **primitives** (extend over time): e.g. delete before Nth occurrence (case-sensitive option), trim, regex extract → named slots.
3. Two **profiles** per tenant: **message** vs **incident** (separate ordered rule lists).
4. **Unit tests** with ICOMM samples: initial dispatch email + close/update email sharing the same CFS number.
5. **Preview:** Same engine in admin UI; **Save** updates what ingest uses next.

**Acceptance:** Tests pass; single module used by ingest and UI preview.

---

## Phase 5 — Incident merge and Create Incident mapping

1. Extract **incident number** from both short and long email shapes.
2. **Enable Incident Creation** off → no auto create/update from parse (email may still ingest per policy).
3. **On** + allowlist pass → **create** draft if new number; **update** if number exists (per-field merge: overwrite vs append — document).
4. **CAD source badge** on incident (auditing).
5. Only tenant-scoped **`POST` / `PATCH` /api/incidents**.

**Acceptance:** First email creates; second email updates same incident; no duplicate CFS.

---

## Phase 6 — Ingest pipeline orchestration

1. Validate **secret** (Phase 2a).
2. Resolve **tenant** from `to` address (existing behavior).
3. **Allowlist** check (Phase 2b).
4. **Insert** `CadEmailIngest` (and quarantine/reject policy if applicable).
5. If allowed and **Enable Incident Creation**: run **incident** rules → create/update incident.
6. Run **message** profile as designed (persist or attach per product decision).
7. **Parse errors:** logged; ingest HTTP behavior aligned with Worker retries (prefer store email even if parse fails, if that is the policy).

**Acceptance:** Staging end-to-end: secret + allowlist + two-email scenario.

---

## Phase 7 — Admin UI completion

- **Message Parsing** and **Incident Parsing:** rule builder, reorder, **Save** → server persistence.
- **Side-by-side:** text used for parsing | parsed output.
- **Raw Email:** list + MIME/base64 for troubleshooting unchanged in purpose.
- **Role gating:** Subadmin+ (or agreed role) for rules and allowlist.

**Acceptance:** Admin can tune rules; **Save** applies to next inbound email automatically.

---

## Phase 8 — Docs and operations

- Update **`docs/procedures/EMAIL_AND_CAD_SETUP.md`** (secret, Worker header, allowlist).
- Keep **`docs/plans/CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md`** aligned or reference this doc as the phase/batch source of truth.
- Staging checklist: Worker URL, secret, allowlist test senders.
- Optional: retention/archival notes for high-volume `CadEmailIngest` (e.g. ~50+/day).

**Acceptance:** New operator can configure from docs alone.

---

## Implementation batches (strike through the whole row when done)

| Batch | Content |
|--------|---------|
| ~~A~~ | ~~Routes + sidebar + move current page to **Raw Email** + redirects~~ |
| ~~B~~ | ~~Enforce **`CAD_INGEST_SECRET`** when `NODE_ENV=production`; Worker README + EMAIL_AND_CAD_SETUP + onboarding + `.env.server.example`~~ |
| C | Prisma: parsing config + allowlist tables + tenant **GET/PATCH** APIs |
| D | Allowlist enforcement on ingest (API; Worker optional) |
| E | Rule engine + unit tests (ICOMM fixtures) |
| F | Incident Parsing UI + preview + Save |
| G | Ingest → parse → create/update incident |
| H | Message Parsing UI + parsed message path |
| I | Docs, indexes/retention notes, staging verification |

---

*Last updated: 2026-04-09 — Batch B: production requires `CAD_INGEST_SECRET` on API; docs + tenant onboarding updated.*
