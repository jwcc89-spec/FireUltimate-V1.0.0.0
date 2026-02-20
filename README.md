# Fire Ultimate (Web Prototype)

React + TypeScript prototype with the condensed menu structure and role-based
navigation.

## Current capabilities

- Auth screen (`/auth`) with simple login mode
- Admin/User role selection at login
- User role has access to all modules except **Admin Functions**
- Sidebar structure:
  - Dashboard
  - Incidents / Mapping (Incidents, Map View, Map Markers)
  - Reporting (NERIS, EMS)
  - Personnel (Schedule, Certifications)
  - Apparatus (Units, Equipment List, Fuel Logs, Maintenance Logs, Mileage Logs)
  - Calendar (Events, Meetings)
  - File Center (Checklists, Daily Logs, E-Forms, Medical Supplies, Water Logs, Vendors, Resources)
  - Fire Prevention (Fire Investigations, Pre-Plans, Inspections, Permits, Properties, Smoke Alarms)
  - Training
  - Admin Functions (Scheduling, Overtime Hiring, Personnel Management, Point Tracker, Manage Groups, Expiration Tracker, Reports, Hydrants, Customization)
  - Messaging (View Messages, Create Message)
- Built-out module pages:
  - Incidents / Mapping -> Incidents (clickable Call # and Dispatch Information table)
  - Incident detail view (`/incidents-mapping/incidents/:callNumber`) with:
    - call information
    - live map placeholder
    - apparatus responding
    - dispatch notes
  - Reporting -> NERIS (incident report queue and incident-based report form scaffold)
    - metadata-driven section/field config
    - required/conditional validation and allowed-value checks
  - Admin Functions -> Hydrants
- Settings gear menu (top right):
  - Profile Management
  - Edit My Display
  - Logout
- Admin Functions -> Customization page scaffold:
  - logo upload
  - color controls
  - dispatch workflow states (Dispatched, Enroute, On scene, Transport, Cleared by default)
- Main menu landing pages now use clickable submenu cards
- "Edit display" control on menu screens allows adding extra submenu cards from other modules

## Run locally

```bash
nvm use
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## NERIS export (test integration)

This project now supports a **server-side proxy** so NERIS auth happens on the server
instead of in the browser.

### 1) Configure the proxy (server credentials)

1. Copy server env template:

```bash
cp .env.server.example .env.server
```

2. Open `.env.server` and set values from your NERIS vendor account:
   - `NERIS_ENTITY_ID` (required)
   - auth option A (recommended):
     - `NERIS_CLIENT_ID`
     - `NERIS_CLIENT_SECRET`
     - `NERIS_USERNAME`
     - `NERIS_PASSWORD`
   - or auth option B:
     - `NERIS_STATIC_ACCESS_TOKEN`

3. Keep OpenAPI defaults unless NERIS tells you otherwise:
   - `NERIS_BASE_URL=https://api.neris.fsri.org/v1`
   - `NERIS_GRANT_TYPE=password`

### 2) Run both servers (2 terminals)

Terminal A:

```bash
npm run proxy
```

Terminal B:

```bash
npm run dev
```

### 3) Configure frontend export values (Admin UI)

1. Sign in as Admin.
2. Go to **Admin Functions -> Customization**.
3. Open **NERIS Export Configuration**.
4. Use these defaults (already set by default):
   - Export URL: `/api/neris/export`
   - Entity ID header: `X-NERIS-Entity-ID`
   - Auth header: `Authorization`
   - Auth scheme: `Bearer`
   - Content-Type: `application/json`
5. Enter your **NERIS Entity ID** in the `NERIS Entity ID` field.
6. Click **Save Customization**.

### 4) Send a test report export

1. Open **Reporting -> NERIS**.
2. Open an incident report.
3. Fill these key fields at minimum:
   - Department NERIS ID
   - Incident number
   - Primary incident type
   - Dispatch/incident location
4. Click **Export**.
5. Check the result message:
   - Success should include NERIS ID when accepted by API.
   - Errors show NERIS validation details from the proxy/API response.

### 5) Quick proxy health check (optional)

```bash
curl http://localhost:8787/api/neris/health
```

You should see JSON with `ok: true`.

### 6) If export returns 403 Forbidden

Run:

```bash
curl http://localhost:8787/api/neris/debug/entities
```

Then compare:
- `submittedEntityId` in export error
- vs `accessibleEntityIds` from debug endpoint

If they do not match, use an entity ID your token can access.
For many accounts this is in OpenAPI format such as `FD########` or `VN########`.

Optional browser env fallback (legacy/testing only):

1. Copy the sample env file:

```bash
cp .env.example .env.local
```

2. Set values in `.env.local` (`VITE_NERIS_EXPORT_URL`, `VITE_NERIS_VENDOR_CODE`, etc.).
3. Restart `npm run dev`.

> Security note: keep real secrets in `.env.server` (server side). Do not store production secrets in browser config fields.

## Notes

- This version is UI-first and uses fake sample data.
- Dispatch center API integration is planned for a future phase.
- Navigation structure is organized to support future mobile app expansion.
- Node.js 20.19.0+ is required (`.nvmrc` is included for version pinning).
