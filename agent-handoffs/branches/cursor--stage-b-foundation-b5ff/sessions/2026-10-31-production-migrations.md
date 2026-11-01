# Agent Handoff Note

## Session metadata
- Date: 2026-10-31 (America/Chicago, UTC-5), about 9:26 p.m.
- Agent type: Cloud
- Agent name/label: Grok 4.7
- User request focus: Send the production migration names that were missing from the earlier count-query reply.
- Working branch: `cursor/stage-b-foundation-b5ff`
- Pull request: https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31. **Do not merge.**

## Work completed
Recorded the production `_prisma_migrations` list. No application code changed. Neon, Render, staging, and production were not modified.

Production already has these 10, in order:

1. `20260306180916_init_multitenant_core`
2. `20260310120000_add_tenant_neris_entity_id`
3. `20260312180000_add_incident_table`
4. `20260312200000_add_cad_email_ingest`
5. `20260314000000_add_neris_export_history`
6. `20260314120000_add_neris_drafts`
7. `20260409140000_add_cad_parsing_settings_and_allowlist`
8. `20260410180000_add_cad_email_parsed_message_text`
9. `20260411120000_fire_recovery_incident_billing`
10. `20260411190000_fire_recovery_tenant_api_credentials`

This branch adds three that production does not have:

- `20261029180000_add_session`
- `20261029200000_add_role_permission_and_account_audit`
- `20261030180000_add_neris_report_change`

`docs/procedures/RELEASE_CHECKLIST.md` does not name individual migrations, so it was not edited.

## Decisions made
- The earlier "active and count 2" was the department-status result. It is not part of the migration list.
- Do not apply the three new tables tonight. They are applied at a planned release, staging first, after a fresh backup.
- Allowed-sender SQL is still written in the release session. Staging `cifpdil` still has 0 allowed senders.

## Next steps for next agent
1. Stay on this branch. Do not merge or deploy.
2. When the user says start Step 10, build Fix 5 first.
3. Before promotion, Crescent still needs `dispatch@co.iroquois.il.us` on the allowed-sender list.
