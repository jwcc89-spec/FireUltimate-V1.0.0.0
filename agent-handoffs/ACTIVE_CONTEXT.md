# Active Context Snapshot

## Current branch
- `neris/phase-1`

## Current focus
- Maintain cross-agent continuity via handoff docs (`cursoragent-context.md`, `ACTIVE_CONTEXT.md`, session notes).
- Continue NERIS export payload hardening and validation follow-up.

## Latest known status
- Handoff workspace docs exist and are active:
  - `agent-handoffs/ACTIVE_CONTEXT.md`
  - `agent-handoffs/HANDOFF_TEMPLATE.md`
  - `agent-handoffs/QUICK_PROMPTS.md`
  - `agent-handoffs/sessions/`
- UI updates from `submenu/neris-ui` are present on this branch.
- NERIS export path is past auth/visibility issues and currently blocked by payload validation responses (`422`) when required fields are incomplete/invalid.

## External dependency status
- NERIS helpdesk enrollment/permissions still gate final export success for some entity IDs/environments.
- If export still fails, capture and use the full response body, especially nested `detail` array entries, to patch the next required field.

## Recent key commits (latest first)
- `bfbb0bc` Add reusable quick prompts for cross-agent workflows
- `7e71374` Add shared cross-agent handoff workspace and template docs
- `8862cce` Add shared Cursor agent context rules document
- `1e06138` Fix hook ordering and export typing after UI cherry-picks
- `3334399` Populate required dispatch unit identifier in export payload
- `06737f2` Adjust resources validation, datetime edits, and popup scrolling

## Current blocker / status
- No handoff-process blocker.
- Product blocker remains: NERIS export `422` payload validation must be iteratively resolved using exact error details from live responses.

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read `agent-handoffs/ACTIVE_CONTEXT.md`.
3. Read latest session note in `agent-handoffs/sessions/`.
4. Ask user which branch to work on before making changes.
5. If working on `neris/phase-1` export flow, reproduce the latest export failure and patch the next required payload field from full `detail` output.
