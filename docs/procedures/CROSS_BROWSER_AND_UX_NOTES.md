# Cross-Browser and UX Notes (Staging Feedback)

**Branch:** `submenu/neris-golive-cifpd`  
**Purpose:** Record what persists across browsers, what was fixed, and known UX issues.

---

## What persists across browsers (after fixes)

| Data | Persists? | Notes |
|------|-----------|--------|
| **Incidents** (list, create, edit, delete) | **Yes** | Step 4: frontend uses Incident API; list loaded from server, create/update/delete via API. |
| **Department Details** (including **Incidents Setup**) | **Yes** | Saved via `POST /api/department-details`. **Fix applied:** On login we now fetch `GET /api/department-details` and write the result to the local draft store, so Create Incident and Edit Incident dropdowns get the **latest** Incidents Setup options without the user having to open Admin → Department Details and click Save. The Department Details page also writes the API response to the draft store when it loads, so any visit to that page keeps the draft in sync. |

---

## What does not persist across browsers (current behavior)

| Data | Persists? | Notes |
|------|-----------|--------|
| **NERIS Export Configuration** (Admin → Customization) | **No** | Stored in localStorage only (`readNerisExportSettings` / `writeNerisExportSettings`). There is no API to save/load these settings per tenant yet. To make them persist, we’d add a tenant-scoped API and load/save from the server. |
| **NERIS report form draft** (in-progress form values before Export) | **No** | Stored in localStorage keyed by incident `callNumber` (`readNerisDraft` / `writeNerisDraft`). To persist across browsers we’d need to save drafts to the server (e.g. new endpoint or a field on the Incident model). |

---

## Known UX issue: NERIS report form “stuck” on first open

**Reported:** Sometimes the NERIS report form appears stuck the first time it’s opened until the user clicks a menu/submenu and then performs a hard refresh.

**Workaround:** Click another menu item (e.g. Incidents) then hard refresh (F5 or Cmd+R), then open the NERIS report again.

**Possible cause:** Initial render or a dependency (e.g. draft load, ref) not updating on first paint. The form already uses `key={callNumber}` so it remounts per incident. If this continues, we can add a focused pass to trace the first-render path and add a guard or force an extra render when the route becomes visible.

---

## Fix applied: Incidents Setup options in Create/Edit Incident

**Problem:** On a second browser, after an admin had updated Incidents Setup on the first browser, the Create Incident and Edit Incident dropdowns showed the **old** options until the user went to Admin → Department Details → Incidents Setup and clicked Save (even though the saved values were already correct).

**Cause:** Create Incident and Incident Detail read their options from `readIncidentsSetupConfigFromDraft()`, which reads from the **localStorage** department-details draft. That draft was only updated when (1) the user visited the Department Details page and (2) clicked Save. So on a new browser, the draft was empty or stale.

**Fix:**

1. **On login:** When the app has an authenticated session, we fetch `GET /api/department-details` and write the response into the same localStorage key used by the draft. So as soon as a user logs in (on any browser), the draft has the latest Incidents Setup.
2. **When Department Details page loads:** When the user opens Admin → Department Details, we already fetch from the API and set React state. We now also write that API response to the same localStorage key, so the draft is updated even if the user never clicks Save.

Result: Create Incident and Edit Incident see the latest options without requiring an admin to open Department Details and click Save on each device.
