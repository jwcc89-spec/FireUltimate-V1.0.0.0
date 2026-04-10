# CAD email dispatch — product & implementation plan

**Branch:** `submenu/neris-golive-cifpd`  
**Status:** In progress — **implementation:** Batches A–G, **G1**, **H**, **I** **done** (2026-04-10). **Next:** **Batch J** (schema approval) → **K** (user-friendly parsing UX). **Product:** end-user-friendly rules (no JSON for departments), field mapping UI, plain-language previews; apparatus matching.  
**Runbooks:** `docs/procedures/EMAIL_AND_CAD_SETUP.md` · Migrations — `docs/user instructions/TENANT_ONBOARDING_CHECKLIST.md` §**I.2**

This file is the **single plan** for incoming CAD email: **what we want the product to do** and **how we are building it** (phases + batches). It replaces having separate “product” and “implementation” CAD plan documents.

**Document maintenance:** Strike through completed phases/bullets/batch rows with `~~…~~`. Do **not** append per-batch operator handoffs or long test runbooks here — use chat/PR. **Agents:** update this file when a phase or batch ships; run `npm run lint` if CI could be affected.

---

## Part 1 — Product goals & UX

### 1.1 Goal

- **Where emails show up:** Admin Functions → **Dispatch Parsing Settings**. Incoming CAD emails are listed; expand a row for raw body / MIME / troubleshooting.
- **Parsing configuration:** Per **tenant**. Dispatch formats differ; **today** each tenant can store its own rule JSON (**Batch H**). **Target (**§1.3b**):** a **shared rule library** (product-maintained); each department **selects which rules apply** — not open-ended JSON authoring for normal setup.
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

**End-user requirement:** Department admins must be able to configure parsing **without editing raw JSON**. Interim admin UIs may expose JSON for power users; **Batch K** delivers the guided experience (see **§ Roadmap — step-by-step** and **Batch K**).

### 1.3a Message parsing vs incident parsing — timeline

- **Historical build order:** Incident automation (ingest → create/update draft incidents) shipped in **Batch G**; **member-facing parsed message text** (`CadEmailIngest.parsedMessageText`) and the **Message Parsing** admin tab shipped in **Batch H**. So engineering prioritized **incident** wiring first, then **message** persistence and UI.
- **Current behavior (post–Batch H):** On each successful **`CadEmailIngest`** insert (after secret + allowlist), the server runs **both** pipelines when configured: **(1)** **Message rules** → `parsedMessageText` (does not require incident automation to be on); **(2)** if **Enable Incident Creation** is on, **incident rules** → create/update incident. They are **parallel concerns**, not sequential phases.
- **Future:** **Batch K** makes **both** Message and Incident rule configuration **user-friendly** (same product direction as §1.3).

### 1.4 Apparatus matching

- **Source of truth:** Department Details apparatus list only.
- Match text like `E4` to fleet; unmatched units are not added.

### 1.5 Incomplete parsing & duplicate incidents

- **Missing fields:** Prefer **create draft with blanks**; optional future: block “complete” until admin fills required fields.
- **Multiple emails, one incident:** Do not create duplicate incidents for the same call; **dedupe** by CAD/CFS/incident number (and related signals) — see Part 2 Phase 5–6.

### 1.6 Permissions

| Action | Role |
|--------|------|
| View raw CAD emails + parsing config (**Dispatch Parsing Settings**) | **Admin and above** (stakeholder); lives under **Admin Functions** — same visibility as other admin-only tools. *Server routes must stay tenant-scoped.* |
| Create/approve incidents (including auto-created) | User+ |

### 1.7 One email → one incident row; updates

- One inbound email must not create two incidents.
- Several emails may **update** the same incident when they refer to the same call.

### 1.11 Incident automation controls (create vs update) — **required product behavior**

- **Today (Batch G):** a single tenant flag **`enableIncidentCreation`** turns **both** automatic **create** and **update** on or off together.
- **Target:** **Separate controls** so a department can e.g. **allow updates** to existing incidents from subsequent CAD messages while **disabling new** auto-created incidents (or the reverse), with rules still defining merge key and field mapping. Exact UX: two toggles (or equivalent) on **Incident Parsing** + persisted on **`CadParsingSettings`**; ingest branches **create** vs **update** paths accordingly.
- **Engineering:** new persisted fields + migration + **`PATCH /api/cad/parsing-config`** + `cadIngestApplyIncidentAutomation` logic + admin copy. **Prisma schema / migrations require explicit approval** before implementation — tracked as **Batch J**.

### 1.8 Auto-created incident UX

- **Draft** state; **CAD source badge** near **Incident #** for auditing.

### 1.9 Call sequencing (optional)

- Optional tenant setting to sequence incident numbers (e.g. next after last manual number). Rules TBD in build.

### 1.10 Product summary

| Topic | Decision |
|-------|----------|
| Email source | Single dispatch system per tenant; formats vary |
| Parsing config | Per tenant; **target:** catalog + **which rules apply** (**§1.3b**) |
| Rule types (direction) | Labels → patterns/regex → highlight-assign |
| Apparatus | Department Details only |
| Missing fields | Draft with blanks first; stricter gating optional later |
| Duplicates | Dedupe / merge by incident/CFS identity |
| Raw email / rules UI | Admin+ (stakeholder; **§1.6**) |
| Incidents | User+ |
| CAD-created incidents | Draft + badge |
| Auto incident **create** vs **update** | **Split toggles** (Batch J); until then, single **`enableIncidentCreation`** controls both |
| Admin parsing UX (no JSON) | **Batch K** — visual/guided rules + field mapping + plain previews |

---

## Roadmap — step-by-step (review checklist)

Use this list to confirm work completes in the **intended order**. **End-user friendly** = department admins never need to edit raw JSON for normal configuration once **Batch K** is done.

| Step | Batch / milestone | What gets done | End-user impact |
|------|-------------------|----------------|-----------------|
| 1 | ~~A–H, G1~~ | Routes, security, persistence, rule engine, incident ingest, MIME/plain text, **message** ingest field + admin panels | Admin+ can configure JSON rules (**§1.6**); ingest runs **message + incident** pipelines |
| 2 | ~~**I**~~ | ~~Docs polish, index/retention **ops notes**, **`CAD_STAGING_VERIFICATION_CHECKLIST.md`**~~ | ~~Operator can validate staging without dev help~~ |
| 3 | **J** | Split **create** vs **update** for incident automation (new fields, API, Incident Parsing UI, ingest branching) | Departments can allow updates without new auto-creates (or reverse); **requires schema approval** |
| 4 | **K** | **User-friendly parsing:** **shared rule library** + tenant **rule selection** (see **§1.3b**), **incident field mapping** UI, merge key UI, **plain-language** previews; phased slices OK | Departments pick rules — no JSON for normal setup |
| 5 | *(product backlog)* | **CAD allowlist admin UI** (API exists), **retention job** + admin settings (time/count per stakeholder), apparatus matching polish, dedupe tuning | Admins manage senders and storage without developers |

**Dependency notes:** **K** can overlap **J** in design spikes but should **not** block **I** or **J**. **J** needs explicit migration approval before coding.

### Stakeholder direction (captured for implementation)

Plain-language decisions to align batches **I / J / K** and follow-ons. *Engineering must reconcile these with the current codebase (see **§1.3b**).*

| Topic | Direction |
|-------|-----------|
| **“CAD settings”** means | **Inside this app only** — Admin Functions → **Dispatch Parsing Settings** (rules, toggles, allowlist, raw email list). **Not** changing software at the 911 center or CAD vendor. |
| **Order of batches** | Flexible as long as work **does not pile up dead or duplicate code**; prefer **one clear path** per feature and remove or supersede old UI when replacing. |
| **Existing users** | None on this feature yet — defaults can be simple; no legacy behavior to preserve. |
| **Email retention** | No legal minimum known. **Target:** admin-configurable **automatic** cleanup: e.g. delete after **N days** *or* after **M stored emails** (or similar). Requires **persisted settings**, **scheduled job** or equivalent, and UX in admin setup — likely **after Batch I** as its own slice (schema approval if new tables/fields). |
| **Shipping style** | **Step-by-step releases** preferred so each slice can be tested before the next. |
| **Parsing rules model** | **Shared rule library** (~25 rules) maintained by the **product team**; each **tenant chooses which rules apply** (not each tenant authoring raw JSON rules from scratch). **§1.3b** — current system uses per-tenant JSON; migration to a catalog is a **major Batch K (or K.1) design task**. |
| **Allowlist** | **Edit inside the app** so admins can react when CAD changes sender; optional UX: “Only allow emails from …” + addresses (often discovered after a **test email** appears under **Raw Email**). **APIs exist** (`GET/PATCH /api/cad/allowlist`); **dedicated admin UI** still to build. |
| **What responders see** | **Only the cleaned parsed text** unless the **rules** intentionally include date/time (or other lines) in that output. |
| **Who runs staging tests** | **Product owner** runs confirmation on staging — implementation must ship **very detailed, click-by-click** test steps (Batch **I** / runbooks). |
| **Staging vs production tenants** | **One tenant** on staging; after go-live, **Crescent** (or delegate) configures parsing rules in **production** and adjusts as needed. |
| **Work priority (when tradeoffs)** | **(1)** Safest **incident** handling → **(2)** Easiest **admin** setup → **(3)** Clearest **documentation**. Use this to order **J** (safety / automation behavior) before purely-UX items where possible, and to schedule doc polish after behavior is stable. |

### 1.3b Rules: current implementation vs target (catalog + tenant selection)

- **Today (shipped):** Each tenant stores **`messageRulesJson`** and **`incidentRulesJson`** on **`CadParsingSettings`** (admin+ edits JSON in admin panels per **§1.6**). The **rule engine** is shared; the **rule text** is per tenant.
- **Target (stakeholder direction):** A **library** of predefined rules (e.g. ~25) ships with the product; tenants **enable or pick** rules that fit their dispatch format — **no tenant-specific rule authoring in JSON** for normal setup.
- **Implication:** Batch **K** must include **data model + UI** for the library and tenant selection, and a **clean migration path** from JSON so we do not leave parallel dead code paths. Exact schema needs **explicit approval** when it touches Prisma.

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
| Create vs update | **Batch J:** separate flags (schema approval). |

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
- ~~**Server:** `server/cadDispatchRuleEngine.mjs` mirrors TS rule engine; `cadIngestApplyIncidentAutomation` in `neris-proxy.mjs` runs after **`CadEmailIngest`** insert.~~ *(Batch G)*

**~~Acceptance:~~** ~~`npm run test` passes; ingest creates/updates incidents when enabled.~~

---

## ~~Phase 5 — Incident merge and Create Incident mapping~~ *(core behavior in Batch G)*

1. ~~Extract **incident number** from slots: **`incidentNumberExtractJson.slot`**, else **`cfs`**, else **`incidentNumber`** slot.~~
2. ~~**Enable Incident Creation** off → no auto create/update (email still stored).~~ *(Batch G; **Batch J** will split into separate create/update toggles — see §1.11.)*
3. ~~**On** + allowlist → **create** draft if new merge key; **update** existing row (**dispatchNotes** appended with separator; other mapped fields overwrite when provided).~~
4. **`dispatchInfo`** default `CAD email ingest` on create — *dedicated CAD badge field later* optional.
5. ~~Tenant-scoped Prisma **`incident.create` / `update`** only.~~

**~~Acceptance:~~** ~~Same merge key → update; different key → new incident.~~ **Optional:** `incidentFieldMapJson` maps **slot → field** (`address`, `incidentType`, `priority`, …).

---

## Phase 6 — Ingest pipeline orchestration

1. ~~Secret (2a) → tenant → allowlist (2b) → **`CadEmailIngest`** insert.~~
2. ~~If allowed and **Enable Incident Creation**: **incident** rules → create/update incident (errors logged; HTTP **200** `{ ok: true }` if email stored).~~ *(Batch G)*
3. ~~**Message** rules on ingest → **`CadEmailIngest.parsedMessageText`** (Batch H).~~
4. ~~Parse errors: logged; ingest still **200** if row stored.~~

**Acceptance:** ~~Staging: secret + allowlist + two emails same merge key → one incident updated.~~ *(Operator verification 2026-04-10.)*

### Known gaps (post–Batch H)

1. ~~**Multipart MIME + quoted-printable (Batch G1):** …~~ *(Shipped: `extractPlainTextFromDecodedMime`, `getDispatchPlainTextFromRawBody`, server mirror, tests.)*
2. **Split create vs update (Batch J):** §1.11 — **schema approval** required.
3. **User-friendly parsing UX (Batch K):** §1.3 + **Roadmap — step-by-step** — no JSON for normal admin workflows; field mapping UI; plain previews.

---

## Phase 7 — Admin UI completion

- ~~Message Parsing: JSON rules + preview + **Save**; ingest writes **`parsedMessageText`**.~~ *(Batch H)* — `DispatchParsingMessagePanel.tsx`.
- ~~Incident Parsing: JSON rules + preview + **Save** (`PATCH /api/cad/parsing-config`); sample text + ICOMM / latest email load.~~ *(Batch F, 2026-04-09)* — superseded by Batch H layout.
- ~~**Incident Parsing UX polish** *(Batch H)* — no ICOMM sample; rules on top; up to **20** emails; side-by-side plain | preview.~~
- ~~Side-by-side: source text | parsed output~~ — *Batch H shipped; visual rule builder may replace JSON later*.
- Raw Email: uses **`getDispatchPlainTextFromRawBody`** for dispatch snippet (Batch G1).
- Role gating: **Admin+** for rules/allowlist (**§1.6**).

**Acceptance:** **Save** persists tenant config; **ingest** applies message + incident pipelines; **Batch H** UI as specified.

---

## Phase 8 — Docs and operations

- Keep **`EMAIL_AND_CAD_SETUP.md`** aligned (secret, Worker, allowlist).
- ~~Staging checklist: Worker URL, secret, allowlist testers.~~ *Batch I: **`docs/procedures/CAD_STAGING_VERIFICATION_CHECKLIST.md`** + **`docs/operations/CAD_DATABASE_INDEXES_AND_RETENTION.md`**.*
- ~~Optional: **`CadEmailIngest`** retention/index notes.~~ *Documented in **`docs/operations/CAD_DATABASE_INDEXES_AND_RETENTION.md`**; automated retention UI is backlog.*

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
| ~~G~~ | ~~Ingest → parse → create/update incident (`server/cadDispatchRuleEngine.mjs` + `cadIngestApplyIncidentAutomation`)~~ |
| ~~G1~~ | ~~**MIME / plain text:** extract **`text/plain`** from **`multipart/*`**; decode **quoted-printable** (and keep base64 support); `extractDispatchPlainText.ts` + `server/cadDispatchRuleEngine.mjs` mirror; tests.~~ |
| ~~H~~ | ~~**Message Parsing:** UI + **`parsedMessageText`** on ingest (`cadIngestApplyMessagePipeline`). **Incident Parsing UX:** rules on top; **20** emails; side-by-side; no ICOMM sample. Migration `parsedMessageText` on **`CadEmailIngest`**.~~ |
| ~~I~~ | ~~Docs polish, indexes/retention notes, **staging operator checklist** (`docs/procedures/CAD_STAGING_VERIFICATION_CHECKLIST.md`, `docs/operations/CAD_DATABASE_INDEXES_AND_RETENTION.md`)~~ |
| J | **Split incident automation:** separate **`enableIncidentAutoCreate`** and **`enableIncidentAutoUpdate`** (names TBD) on **`CadParsingSettings`**, API, Incident Parsing UI, ingest branching. **Requires explicit Prisma migration approval.** Optional later: rule conditions for “when to update.” |
| K | **User-friendly parsing:** **shared rule library** + tenant **rule selection** (§1.3b); **incident field mapping** + merge-key UI; **plain-language** previews; remove reliance on tenant-authored JSON for normal setup. Phased delivery OK. |

---

## Technical references (existing vs upcoming)

- **Today:** `CadEmailIngest` (+ **`parsedMessageText`**); `POST /api/cad/inbound-email` (**message** pipeline + optional **incident** automation); `server/cadDispatchRuleEngine.mjs` (rules + MIME extract); **Message** + **Incident Parsing** admin UI (**per-tenant JSON** until **Batch K** replaces with **rule library + selection** per §1.3b). **Batch J** = split create/update flags.
- **App entry:** Admin Functions → **Dispatch Parsing Settings** → **Message Parsing** / **Incident Parsing**.

---

*Last updated: 2026-04-09 — **Batch I** complete: staging checklist + DB index/retention ops notes; linked from `EMAIL_AND_CAD_SETUP.md`.*
