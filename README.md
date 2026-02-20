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

Preferred setup (UI):

1. Sign in as Admin.
2. Go to **Admin Functions -> Customization**.
3. Open **NERIS Export Configuration**.
4. Enter endpoint URL, vendor code/header, secret key, auth header/scheme, and content type.
5. Click **Save Customization**.
6. Open a NERIS incident report and click **Export** (next to **Import**).

Environment-file setup (optional fallback):

1. Copy the sample env file:

```bash
cp .env.example .env.local
```

2. Set values in `.env.local` (`VITE_NERIS_EXPORT_URL`, `VITE_NERIS_VENDOR_CODE`, `VITE_NERIS_SECRET_KEY`, etc.).
3. Restart `npm run dev`.

> Important: this prototype is frontend-only. UI/env secrets are stored client-side and visible to users with browser access. Use a backend proxy for production and keep real secrets server-side only.

## Notes

- This version is UI-first and uses fake sample data.
- Dispatch center API integration is planned for a future phase.
- Navigation structure is organized to support future mobile app expansion.
- Node.js 20.19.0+ is required (`.nvmrc` is included for version pinning).
