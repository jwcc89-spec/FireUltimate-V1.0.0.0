# CAD dispatch parsing — implementation plan (master)

**Branch:** `submenu/neris-golive-cifpd`  
**Status:** In progress (Batches A–D done for CAD ingest path; **next:** Batch E rule engine)  
**Related:** Product goals and rule types — `docs/plans/CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md`  
**Runbooks:** `docs/procedures/EMAIL_AND_CAD_SETUP.md`

---

## How to update this document when work completes

Use Markdown strikethrough: `~~text~~` so it renders as ~~text~~.

1. When a **Phase** is fully done, strike through the **phase number and title** in the heading, e.g. `~~Phase 1 — …~~`.
2. When individual **bullets or table rows** inside a phase are done, strike through those lines only (leave the phase header until the whole phase is done).
3. When a **batch** row in the implementation batch table is done, strike through the **entire row** (all columns in that row).

**Agents:** After completing a phase or batch, update this file in the same commit or immediately after merge, then run `npm run lint` if you touched anything that could affect CI.

**Agents:** After **every** implementation batch merged to this branch, add or update the **Current snapshot** section below with: (1) **What you need to complete** — numbered steps for deploy, migrations, env vars, Cloudflare, Neon, no jargon without explanation; (2) **What you need to test** — numbered checks the operator can run in the app or browser; (3) **What remains** — which batches/phases are still open in this sequence.

---

## Operator handoff template (fill in after each batch)

Copy this block into **Current snapshot** (below) and replace the placeholders.

### What you need to complete

1. …
2. …

### What you need to test

1. …
2. …

### What remains in this sequence

- **Done:** …
- **Not started yet:** … (see **Implementation batches** table)

---

## Current snapshot — CAD dispatch sequence *(update after each batch)*

**Code baseline:** Latest on branch **`submenu/neris-golive-cifpd`** including **Batch D** (allowlist enforced on ingest when ≥1 enabled row). **Migrations required for Batch C** are already documented in **`docs/user instructions/TENANT_ONBOARDING_CHECKLIST.md`** §**I.2**.

### What you need to complete

1. **Deploy the API** on Render (staging and/or production) so the running service includes **Batch D** server code (merge/pull the branch, then **Manual Deploy** or auto-deploy).
2. **No new database migration** for Batch D (only Batch C migration applies). If you have **not** yet run **`20260409140000_add_cad_parsing_settings_and_allowlist`**, do **§I.2** in **`TENANT_ONBOARDING_CHECKLIST.md`** first.
3. **Allowlist is optional.** If you **do not** add any enabled allowlist rows, behavior is **unchanged** (all senders accepted). When you are ready to restrict senders, use **`PATCH /api/cad/allowlist`** (see **`docs/procedures/EMAIL_AND_CAD_SETUP.md`** §**B6.5**) while logged in on the tenant host, or call the API with your session. **Add your real dispatch domain first** (e.g. `domain_suffix` for the vendor’s domain) so you do not block legitimate mail.
4. **Cloudflare Worker** does not need changes for Batch D (API-only enforcement).

### What you need to test

1. **Baseline (no allowlist rows or all disabled):** Send a test CAD email → **Render logs** show **`POST /api/cad/inbound-email`** with **200** and **`{ ok: true }`** → **Raw Email** in the app shows a new row → optional Neon: row in **`CadEmailIngest`**.
2. **With restriction:** Add **one** enabled **`domain_suffix`** that matches your test sender → send again → still **200** + **`ok: true`** and a new row.
3. **Rejection path:** Add patterns so the **From** address **does not** match → **200** with **`ok: false`**, **`code`: `"cad_allowlist"`** → **no** new **`CadEmailIngest`** row → Worker should **not** spin forever (queue acks).

### What remains in this sequence

| Batch | Status |
|--------|--------|
| A–D | **Done** (UI shell, secret, DB + APIs, allowlist enforce). |
| **E** | Rule engine + unit tests (ICOMM samples). |
| **F** | Incident Parsing UI + preview + Save. |
| **G** | Ingest → parse → create/update **incidents** when enabled. |
| **H** | Message Parsing UI + parsed message path. |
| **I** | Docs polish, optional indexes/retention, staging verification. |

**Phases still open in this doc:** **4** (rule engine), **5** (incident merge + mapping), **6** (full ingest pipeline with parsing), **7** (admin UI beyond placeholders), **8** (final docs/ops).

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

### ~~2b — Allowlist / spam filtering~~ *(Batch C storage + Batch D API enforcement)*

**Status:** **`CadEmailAllowlistEntry`** + **`GET/PATCH /api/cad/allowlist`** (Batch C). **`POST /api/cad/inbound-email`** enforces allowlist when **≥1 enabled** row exists (Batch D). **Empty allowlist** = **allow all** (backward compatible). Rejected sends return **200** + **`ok: false`**, **`code`: `"cad_allowlist"`** — no **`CadEmailIngest`** row; Worker still **acks**.

- ~~**Tenant-configurable allowlist** in DB (`CadEmailAllowlistEntry`: `pattern`, `patternType` = `domain_suffix` \| `exact_email` \| `regex`, `enabled`, `sortOrder`).~~
- **Worker (first line):** Optionally drop before POST — *deferred / optional*.
- ~~**API:** Match **`From`** (extract email from `Name <a@b.com>`) before **`CadEmailIngest.create`**.~~
- **Default posture:** **No enabled rows** → allow all; **≥1 enabled row** → must match at least one pattern.
- **Admin UI:** Manage allowlist — *later batch*.

**Acceptance:** ~~Secret~~ *(B)*; ~~persistence~~ *(C)*; ~~enforce on ingest~~ *(D)*.

---

## ~~Phase 3 — Persistence model (dedicated tables)~~ *(Batch C, 2026-04-09)*

- ~~**`CadParsingSettings`** (one row per `tenantId`): `enableIncidentCreation`, `messageRulesJson`, `incidentRulesJson`, `incidentFieldMapJson`, `incidentNumberExtractJson`.~~
- ~~**`CadEmailAllowlistEntry`**: `tenantId`, `pattern`, `patternType`, `enabled`, `sortOrder`.~~
- ~~**APIs:** `GET` / `PATCH` **`/api/cad/parsing-config`**, `GET` / `PATCH` **`/api/cad/allowlist`** (tenant from host; same trust model as `/api/department-details`).~~
- ~~**Client:** `src/api/cadDispatchConfig.ts` for later UI batches.~~
- Optional later: `CadEmailIngest` status columns / indexes for quarantine filtering.

**~~Acceptance:~~** ~~Migration `20260409140000_add_cad_parsing_settings_and_allowlist`; tenant isolation on all reads/writes.~~

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
| ~~C~~ | ~~Prisma: **`CadParsingSettings`** + **`CadEmailAllowlistEntry`**; **`GET`/`PATCH` `/api/cad/parsing-config`** and **`/api/cad/allowlist`**; `src/api/cadDispatchConfig.ts`~~ |
| ~~D~~ | ~~Allowlist on **`POST /api/cad/inbound-email`** when ≥1 enabled row; **200** + **`ok: false`** if rejected (Worker acks); empty list = allow all~~ |
| E | Rule engine + unit tests (ICOMM fixtures) |
| F | Incident Parsing UI + preview + Save |
| G | Ingest → parse → create/update incident |
| H | Message Parsing UI + parsed message path |
| I | Docs, indexes/retention notes, staging verification |

---

*Last updated: 2026-04-09 — Operator handoff template + current snapshot; Batch D allowlist.*
