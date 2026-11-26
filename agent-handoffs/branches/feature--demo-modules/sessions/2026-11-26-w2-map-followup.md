# Agent Handoff Note

## Session metadata
- Date: 2026-11-26 (Chicago late morning)
- Agent type: Cursor Desktop, Claude Opus 5.5
- User request focus: map changes from the operator's W2 check, removing the Incidents page sample cards, and recording that all testing is on staging.
- Working branch: `feature/demo-modules`

## Work completed
- **Testing rule:** the operator tests on staging only. This was added to `.cursor/rules/agent-execution-contract.mdc`, `docs/agent-execution-contract.md` § 7, `cursoragent-context.md` item 34a, `.cursor/project-context.md`, the demo plan, and `ACTIVE_CONTEXT.md`.
- **Incidents page:** the four sample stat cards are removed. Reminder to consider them for the Dashboard.
- **Maps:**
  - New: `HtmlMarker.tsx`, `CallLocator.tsx`, `MapSearch.tsx`.
  - Changed: `MapCanvas.tsx`, `CallMap.tsx`, `mapUtils.ts`, and CSS.
  - Details are in the plan's "W2 follow-up round" note.

## Verification
- `npm run lint`, `npm run build`: pass.
- `npm test`: 93 pass, 2 fail. The failures are the known local-Postgres tests.
- **Not done:** a browser check. The operator tests on staging, and staging can't take this branch until the displays migration is applied.

## Open issues / blockers
- Staging needs the five migrations before `feature/demo-modules` can merge, because W3 adds `Incident` columns.
- Google Cloud: enable Places API (New) on the browser key for search suggestions.

## Next steps for next agent
1. Wait for the operator's staging check of the map changes and W3.
2. Then W4 (Inventory), after restating its scope.
