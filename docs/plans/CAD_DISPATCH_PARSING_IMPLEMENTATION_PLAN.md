# CAD email dispatch — product & implementation plan

**Branch:** `submenu/neris-golive-cifpd`  
**Status:** In progress — **implementation:** Batches A–F done; **next:** Batch G (ingest → parse → create/update incident). **Product:** auto-create on ingest + Message Parsing UI remain open (see batches G–I).  
**Runbooks:** `docs/procedures/EMAIL_AND_CAD_SETUP.md` · Migrations — `docs/user instructions/TENANT_ONBOARDING_CHECKLIST.md` §**I.2**

This file is the **single plan** for incoming CAD email: **what we want the product to do** and **how we are building it** (phases + batches). It replaces having separate “product” and “implementation” CAD plan documents.

**Document maintenance:** Strike through completed phases/bullets/batch rows with `~~…~~`. Do **not** append per-batch operator handoffs or long test runbooks here — use chat/PR. **Agents:** update this file when a phase or batch ships; run `npm run lint` if CI could be affected.

---

## Part 1 — Product goals & UX

### 1.1 Goal

- **Where emails show up:** Admin Functions → **Dispatch Parsing Settings**. Incoming CAD emails are listed; expand a row for raw body / MIME / troubleshooting.
- **Parsing configuration:** Per **tenant**. Each department defines its own rules (dispatch formats differ). Departments configure this, not the program owner.
- **When parsing drives incidents:** When rules are applied on ingest, the app should **auto-create or update** incidents (draft) from parsed text where rules match; unmapped fields stay blank. Apparatus is matched to **Department Details → Apparatus**; unrecognized units are not added.
- **Why:** (1) Inform responders during the call (address, units, notes; later routing). (2) Pre-populate NERIS flows. Auto-created incidents are **Draft**; NERIS export locking is separate.

### 1.2 Email source and format

- One dispatch system per tenant, but **formats may vary**; rules must support multiple shapes (e.g. different templates or ordered rule trials).
- Raw mail is stored in **`CadEmailIngest`**; parsing reads normalized/plain text derived from that (or equivalent).

### 1.3 Parsing rules — product design (priority)

Build toward (order can overlap engineering phases):

1. **A — Predefined labels** — e.g. `Nature:`, `Address:` → map label → incident field; only mapped fields apply.
2. **C — Pattern-based rules** — regex / “line after X” where labels are inconsistent (aligns with engine primitives in Part 2 / Batch E).
3. **B — Highlight and assign** — select text in a sample and map to a field (after A and C).

**Stackable rules (example):** between 1st and 2nd hard return → **Address**; position/delimiter/target field as dropdowns in UI over time.

### 1.4 Apparatus matching

- **Source of truth:** Department Details apparatus list only.
- Match text like `E4` to fleet; unmatched units are not added.

### 1.5 Incomplete parsing & duplicate incidents

- **Missing fields:** Prefer **create draft with blanks**; optional future: block “complete” until admin fills required fields.
- **Multiple emails, one incident:** Do not create duplicate incidents for the same call; **dedupe** by CAD/CFS/incident number (and related signals) — see Part 2 Phase 5–6.

### 1.6 Permissions

| Action | Role |
|--------|------|
| View raw CAD emails + parsing config | Subadmin+ |
| Create/approve incidents (including auto-created) | User+ |

### 1.7 One email → one incident row; updates

- One inbound email must not create two incidents.
- Several emails may **update** the same incident when they refer to the same call.

### 1.8 Auto-created incident UX

- **Draft** state; **CAD source badge** near **Incident #** for auditing.

### 1.9 Call sequencing (optional)

- Optional tenant setting to sequence incident numbers (e.g. next after last manual number). Rules TBD in build.

### 1.10 Product summary

| Topic | Decision |
|-------|----------|
| Email source | Single dispatch system per tenant; formats vary |
| Parsing config | Per tenant |
| Rule types (direction) | Labels → patterns/regex → highlight-assign |
| Apparatus | Department Details only |
| Missing fields | Draft with blanks first; stricter gating optional later |
| Duplicates | Dedupe / merge by incident/CFS identity |
| Raw email / rules UI | Subadmin+ |
| Incidents | User+ |
| CAD-created incidents | Draft + badge |

---

## Part 2 — How to update when work completes

1. When a **Phase** is fully done, strike through the **phase number and title** in the heading.
2. When individual **bullets** inside a phase are done, strike through those lines only.
3. When a **batch** row is done, strike through the **entire row**.

---

## Phase 0 — Engineering decisions & constraints

| Topic | Decision |
|--------|-----------|
| Tenant scope | Parsing config, rules, allowlists, flags are **per-tenant** (`tenantId`). |
| Incident identity | Merge/create key = **CAD/CFS incident number** from message text (tenant-specific extraction rules). |
| When rules run | **(A)** Admin UI: **preview** while editing (no incident writes from typing alone). **(B)** **Save** persists config. **(C)** On **ingest**, server loads **saved** rules and runs them — same engine as preview. |
| End-user experience | Responders see **parsed outputs**, not raw email or rule definitions. |
| Persistence | **`CadParsingSettings`**, **`CadEmailAllowlistEntry`**, **`CadEmailIngest`**. **Prisma schema/migrations require explicit approval** before merge. |
| Time format | Parsed times **24-hour `HH:MM:SS`**. |
| Secrets | **`CAD_INGEST_SECRET`** in production API; Worker sends **`X-CAD-Ingest-Secret`**. **No secrets** in `DepartmentDetails.payloadJson` or parsing rule JSON. |
| Spam / abuse | **Allowlist** so junk does not become incidents or member messages (see Phase 2). |

---

## ~~Phase 1 — Information architecture and routes~~

1. ~~**Parent path:** `/admin-functions/dispatch-parsing-settings` → **redirect** to **`/admin-functions/dispatch-parsing-settings/raw-email`**.~~
2. ~~**Left sidebar:** Message Parsing, Incident Parsing, Raw Email (Raw Email last).~~

| Child | Route | Purpose |
|--------|--------|---------|
| ~~Message Parsing~~ | ~~`/admin-functions/dispatch-parsing-settings/message-parsing`~~ | ~~Parsed message string (Batch H).~~ |
| ~~Incident Parsing~~ | ~~`/admin-functions/dispatch-parsing-settings/incident-parsing`~~ | ~~Dispatch text vs parsed fields; **Enable Incident Creation** (Batch F).~~ |
| ~~Raw Email~~ | ~~`/admin-functions/dispatch-parsing-settings/raw-email`~~ | ~~List + MIME/base64 troubleshooting (Batch A).~~ |

3. ~~Legacy dispatch parsing URLs → redirect into this tree.~~

**~~Acceptance:~~** ~~Three routes + sidebar + redirects.~~ *(Batch A, 2026-04-09.)*

---

## Phase 2 — Security: secret and allowlist

### ~~2a — Secret (mandatory)~~ *(Batch B, 2026-04-09)*

- ~~**`CAD_INGEST_SECRET`** on API; Worker **`X-CAD-Ingest-Secret`**.~~
- ~~**`NODE_ENV=production`:** unset secret → **503**; bad header → **401**.~~
- ~~Docs: **`EMAIL_AND_CAD_SETUP.md`**, Worker README, **`.env.server.example`**, onboarding.~~

### ~~2b — Allowlist / spam filtering~~ *(Batch C + D)*

**Implemented:** **`CadEmailAllowlistEntry`** + **`GET/PATCH /api/cad/allowlist`**. **`POST /api/cad/inbound-email`** enforces when **≥1 enabled** row. **Empty** = allow all. Reject → **200** + **`ok: false`**, **`code`: `"cad_allowlist"`**; no **`CadEmailIngest`** row; Worker **acks**.

- ~~DB + API **`From`** match before **`CadEmailIngest.create`**.~~
- **Worker (optional):** drop before POST — *deferred*.
- **Admin UI** to manage allowlist — *later batch*.

**Acceptance:** ~~B / C / D~~ as marked.

---

## ~~Phase 3 — Persistence model~~ *(Batch C, 2026-04-09)*

- ~~**`CadParsingSettings`** per tenant: `enableIncidentCreation`, `messageRulesJson`, `incidentRulesJson`, `incidentFieldMapJson`, `incidentNumberExtractJson`.~~
- ~~**`CadEmailAllowlistEntry`**.~~
- ~~**APIs:** **`/api/cad/parsing-config`**, **`/api/cad/allowlist`**.~~
- ~~**Client:** `src/api/cadDispatchConfig.ts`.~~

**~~Acceptance:~~** ~~Migration `20260409140000_add_cad_parsing_settings_and_allowlist`; tenant isolation.~~

---

## ~~Phase 4 — Rule engine (shared library)~~ *(Batch E, 2026-04-09)*

- ~~**Normalize:** `src/cadDispatch/normalizeDispatchText.ts`.~~
- ~~**Engine:** `src/cadDispatch/ruleEngine.ts` — `parseCadRulesJson`, `runCadRulePipeline`, primitives → **slots**.~~
- ~~**Profiles:** **`messageRulesJson`** vs **`incidentRulesJson`** (UI/ingest wiring in F/G).~~
- ~~**Tests:** `icommFixtures.ts`, **`npm run test`**.~~
- **Server:** `neris-proxy.mjs` does not import TS yet — **Batch G** bridges the module into Node.

**~~Acceptance:~~** ~~`npm run test` passes.~~

---

## Phase 5 — Incident merge and Create Incident mapping

1. Extract **incident number** from short/long email shapes.
2. **Enable Incident Creation** off → no auto create/update from parse (ingest policy may still store email).
3. **On** + allowlist → **create** draft if new number; **update** if exists (merge policy: document overwrite vs append).
4. **CAD source badge** on incident.
5. Tenant-scoped **`POST` / `PATCH` /api/incidents** only.

**Acceptance:** First email creates; second updates same incident; no duplicate CFS.

---

## Phase 6 — Ingest pipeline orchestration

1. Secret (2a) → tenant → allowlist (2b) → **`CadEmailIngest`** insert.
2. If allowed and **Enable Incident Creation**: **incident** rules → create/update incident.
3. **Message** profile per product decision.
4. Parse errors: logged; HTTP behavior compatible with Worker retries.

**Acceptance:** Staging end-to-end: secret + allowlist + two-email scenario.

---

## Phase 7 — Admin UI completion

- Message Parsing: rule builder, reorder, **Save** — *still open (Batch H)*.
- ~~Incident Parsing: JSON rules + preview + **Save** (`PATCH /api/cad/parsing-config`); sample text + ICOMM / latest email load.~~ *(Batch F, 2026-04-09)* — `DispatchParsingIncidentPanel.tsx`, `extractDispatchPlainText.ts` shared with Raw Email.
- Side-by-side: source text | parsed output — *incident page uses two-column layout; visual rule builder may replace JSON later*.
- Raw Email: troubleshooting unchanged.
- Role gating: Subadmin+ for rules/allowlist.

**Acceptance:** **Save** persists tenant config; **ingest** applies on next email **after Batch G**.

---

## Phase 8 — Docs and operations

- Keep **`EMAIL_AND_CAD_SETUP.md`** aligned (secret, Worker, allowlist).
- Staging checklist: Worker URL, secret, allowlist testers.
- Optional: **`CadEmailIngest`** retention/index notes.

**Acceptance:** Operator can configure from runbooks + this plan.

---

## Implementation batches (strike through the whole row when done)

| Batch | Content |
|--------|---------|
| ~~A~~ | ~~Routes + sidebar + **Raw Email** + redirects~~ |
| ~~B~~ | ~~**`CAD_INGEST_SECRET`** in production; docs + Worker + `.env.server.example`~~ |
| ~~C~~ | ~~**`CadParsingSettings`** + **`CadEmailAllowlistEntry`**; **`/api/cad/parsing-config`** + **`/api/cad/allowlist`**; `cadDispatchConfig.ts`~~ |
| ~~D~~ | ~~Allowlist on **`POST /api/cad/inbound-email`**; **200** + **`ok: false`** if rejected~~ |
| ~~E~~ | ~~Rule engine + tests (ICOMM fixtures); `src/cadDispatch/`~~ |
| ~~F~~ | ~~Incident Parsing UI + preview + Save (`getCadParsingConfig` / `patchCadParsingConfig`, `runCadRulePipeline`)~~ |
| G | Ingest → parse → create/update incident |
| H | Message Parsing UI + parsed message path |
| I | Docs polish, indexes/retention, staging verification |

---

## Technical references (existing vs upcoming)

- **Today:** `CadEmailIngest`; `POST /api/cad/inbound-email`; Worker → API; `GET /api/cad/emails` for Raw Email list; parsing config + allowlist APIs; `src/cadDispatch/` rule engine (Batch E); **Incident Parsing** UI + preview (Batch F).
- **App entry:** Admin Functions → **Dispatch Parsing Settings** → **Incident Parsing**.

---

*Last updated: 2026-04-09 — Batch F Incident Parsing UI; merged CAD plan docs (earlier same day).*
