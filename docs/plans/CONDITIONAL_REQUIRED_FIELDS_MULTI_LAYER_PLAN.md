# Conditional Required Fields (Global + Tenant) — Implementation Plan

## Purpose

Define and implement a two-layer conditional required-field system for NERIS form fields:

1. **Platform default conditional rules** (applies to all tenants)
2. **Tenant-admin conditional rules** (per tenant overrides/additions)

This plan is intended for the next agent to execute in phases with low risk and clear verification.

---

## Why this is needed

Today, requiredness is driven by:
- NERIS hard-required fields
- NERIS conditional required (`requiredIf`) metadata
- tenant admin "always require" style overrides

Need:
- a consistent way to define additional **conditional** requiredness globally and per tenant
- clear precedence and conflict handling
- consistent behavior in:
  - Required badges/asterisks
  - Show Required Fields Only
  - Validate / errors
  - Export pre-check readiness

---

## Scope

### In scope
- Rule engine for global + tenant conditional rules
- Persistence contract for tenant rules
- Admin UI to manage tenant conditional rules
- Requiredness reason messaging in form
- Validation behavior consistency
- Tests for rule evaluation and integration points

### Out of scope (for this plan)
- Prisma schema changes
- Auth/role model redesign
- NERIS export payload shape changes
- Cross-tenant admin controls in tenant UI

---

## Constraints and non-negotiables

- Preserve tenant isolation (tenant rules only affect that tenant)
- Do not weaken NERIS hard-required behavior
- No secrets in `DepartmentDetails.payloadJson`
- Keep deterministic rule evaluation (same input => same requiredness result)
- Keep app-wide 24-hour time format unchanged
- Do not modify authentication/authorization logic without explicit approval

---

## Definitions

- **NERIS hard-required:** field marked required by NERIS metadata unconditionally
- **NERIS conditional-required:** field required by metadata `requiredIf` when condition matches
- **Platform conditional rule:** default conditional rule applied to all tenants
- **Tenant conditional rule:** tenant-level conditional rule managed in Admin UI
- **Always-required override:** tenant admin marks field required regardless of condition

---

## Requiredness precedence (single source of truth)

For each field, evaluate in this order:

1. NERIS hard-required
2. NERIS conditional-required (`requiredIf`)
3. Platform conditional rules
4. Tenant conditional rules
5. Tenant always-required override

Recommended effective expression:

`effectiveRequired = nerisHardRequired || nerisConditional || platformConditional || tenantConditional || tenantAlwaysRequired`

Notes:
- No rule may set a NERIS-hard-required field to optional.
- If future "disable rule" behavior is desired, add explicit policy and guardrails in a separate phase.

---

## Data contracts

## 1) Platform defaults (code-first)

Add a static config file for global rules, example:
- `src/nerisConditionalRules.ts`

Proposed type:

```ts
type ConditionalOperator = "equals" | "notEquals" | "isEmpty" | "notEmpty" | "includes";

interface ConditionalClause {
  fieldId: string;
  operator: ConditionalOperator;
  value?: string;
}

interface ConditionalRequiredRule {
  id: string; // stable id
  targetFieldId: string;
  whenAll: ConditionalClause[]; // AND semantics
  enabled: boolean;
  source: "platform" | "tenant";
  label?: string;
  note?: string;
}
```

## 2) Tenant rules (`DepartmentDetails.payloadJson`)

Use payload JSON (no schema migration):

```json
{
  "tenantConditionalRequiredRules": [
    {
      "id": "tenant-rule-uuid",
      "targetFieldId": "person_owner_vehicle_make",
      "whenAll": [
        { "fieldId": "primary_incident_type", "operator": "equals", "value": "MOTOR_VEHICLE_COLLISION" }
      ],
      "enabled": true,
      "source": "tenant",
      "label": "MVC requires vehicle make"
    }
  ]
}
```

Also keep existing always-required override structure unchanged.

---

## UI behavior requirements

Location: **Admin Functions -> Reporting -> NERIS Required Fields**

For each field row show:
- NERIS status badge:
  - Required
  - Conditionally required by NERIS
  - Optional
- Platform conditional badge (read-only if matched by platform default)
- Tenant controls:
  - Add conditional rule
  - Edit/remove own tenant rules for that field
  - Existing "always require" behavior remains

Rule builder UX (tenant):
- Target field (row context)
- Condition builder (at least 1 clause in `whenAll`)
- Operator picker
- Value input/select depending on source field type
- Enable/disable toggle
- Save/Delete controls

---

## Form UX behavior requirements

Anywhere field requiredness appears, use the same effective required engine:
- field required indicator
- Show Required Fields Only
- section validation / issue list
- Validate action

Add clear reason text (small helper):
- "Required by NERIS"
- "Conditionally required by NERIS"
- "Conditionally required by platform rule"
- "Conditionally required by your department rule"
- "Required by department override"

---

## Implementation phases

## Phase 1 — Rule engine foundation (no admin UI changes yet)

Deliverables:
- Add rule types and evaluator utility:
  - evaluate clause
  - evaluate rule
  - evaluate set of rules
- Integrate platform rule set and tenant rule set read path
- Compute `effectiveRequired` in one place used by:
  - required checks
  - Show Required Fields Only filtering
  - validation

Acceptance:
- Existing behavior unchanged when no new rules configured
- NERIS hard-required remains unbreakable

Verification:
- Unit tests for operator logic and rule evaluation
- `npm run lint`
- `npm run build`

---

## Phase 2 — Tenant persistence and read/write plumbing

Deliverables:
- Extend DepartmentDetails payload handling on client with:
  - `tenantConditionalRequiredRules`
- Ensure safe merge behavior on save:
  - read latest payload
  - merge updated rules
  - post merged payload

Acceptance:
- Rules persist per tenant
- No cross-tenant leakage
- Existing payload keys preserved

Verification:
- Tenant A/B manual check
- API checks for department details routes
- `npm run lint`
- `npm run build`

---

## Phase 3 — Admin UI for tenant conditional rules

Deliverables:
- Add rule management controls in Required Fields admin page
- Add create/edit/delete for tenant conditional rules
- Display platform badges (read-only)

Acceptance:
- Admin can add a rule and see it affect requiredness in form
- Admin can remove/disable rule and behavior reverts

Verification:
- Manual scenario matrix (see Testing section)
- `npm run lint`
- `npm run build`

---

## Phase 4 — Requiredness reason messaging in NERIS form

Deliverables:
- Helper text/reason badges for why a field is required
- Keep text concise and non-disruptive

Acceptance:
- User can tell why field is required without ambiguity

Verification:
- Visual QA in core, conditional, and overridden cases
- `npm run lint`
- `npm run build`

---

## Phase 5 — Hardening and tests

Deliverables:
- Add integration tests for:
  - platform only
  - tenant only
  - both true
  - both false
  - hard-required unaffected
- Add guards:
  - invalid target field ids ignored safely
  - malformed clauses ignored with warning

Acceptance:
- No regressions in validation/export readiness flow

Verification:
- Full lint/build
- targeted API checks where applicable

---

## Test matrix (minimum)

1. NERIS hard-required field + no rules -> required
2. NERIS conditional false + no extra rules -> optional
3. Platform rule true -> required
4. Tenant rule true -> required
5. Platform false + tenant true -> required
6. Platform true + tenant false -> required
7. All false + not hard-required -> optional
8. Tenant always-required -> required
9. Show Required Fields Only reflects all above
10. Validation issue list matches all above

---

## Risks and mitigations

- **Risk:** rule sprawl causes confusing admin UX  
  **Mitigation:** start with simple `whenAll` (AND only), no nested groups in v1.

- **Risk:** inconsistent requiredness across screens  
  **Mitigation:** single shared evaluator utility used everywhere.

- **Risk:** bad rule data breaks form  
  **Mitigation:** defensive parsing + ignore invalid rules + console warning.

- **Risk:** performance with many rules  
  **Mitigation:** memoize computed results by formValues + rule sets.

---

## Now vs Later

## Now
- Implement phases 1–3 (engine, persistence, admin UI)
- Ensure all requiredness entry points consume same evaluator

## Later
- Advanced rule builder (OR groups, nested logic)
- Rule templates per incident type
- Platform UI for editing global defaults (instead of code config)
- Audit trail for tenant rule changes

---

## Handoff checklist for next agent

- [ ] Confirm current branch with user before coding
- [ ] Implement Phase 1 first and keep behavior stable
- [ ] Run `npm run lint` and `npm run build` after each phase
- [ ] Validate tenant isolation explicitly
- [ ] Update this plan with what changed and what is deferred
- [ ] Document any assumptions/blockers instead of guessing

---

## Success criteria (final)

- Admin can manage tenant conditional required rules in Reporting -> NERIS Required Fields
- Platform default conditional rules apply across all tenants
- Requiredness is consistent across required indicators, filter, and validation
- NERIS hard-required semantics preserved
- No schema/auth changes required

