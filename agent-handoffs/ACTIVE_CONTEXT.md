# Active Context Snapshot

## Current branch
- `neris/phase-1`

## Current focus
- NERIS export integration and payload validation hardening.
- UI updates have been merged in from `submenu/neris-ui` onto this branch.

## Latest known status
- OAuth auth and entity visibility are working on NERIS test API.
- Export progressed from 403 (permission) to 422 (payload validation).
- Latest fix added state normalization and dispatch unit fallback payload fields.

## External dependency status
- NERIS helpdesk enrolled client ID for:
  - `FD01001122`
  - `FD01001416`
- If new export validation errors appear, capture full `detail` array for next patch.

## Recent key commits (latest first)
- `8862cce` Add shared Cursor agent context rules document
- `1e06138` Fix hook ordering and export typing after UI cherry-picks
- `3334399` Populate required dispatch unit identifier in export payload
- `0987b71` Normalize state values before NERIS payload submission

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read latest session note in `agent-handoffs/sessions/`.
3. Ask user which branch to work on.
4. Reproduce current export error and patch next failing field if needed.
