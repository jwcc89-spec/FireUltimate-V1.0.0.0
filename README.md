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

1. Copy the sample env file:

```bash
cp .env.example .env.local
```

2. Set these values in `.env.local`:
   - `VITE_NERIS_EXPORT_URL` = your export endpoint (recommended: your backend proxy URL)
   - `VITE_NERIS_VENDOR_CODE` = your test vendor/department code
   - `VITE_NERIS_SECRET_KEY` = your test secret key
3. Restart `npm run dev` after updating `.env.local`.
4. Open a NERIS incident report and click **Export** (next to **Import**).

> Important: this prototype is frontend-only. Secrets in `VITE_` variables are visible in the browser bundle. Use a backend proxy for production and keep real secrets server-side only.

## Notes

- This version is UI-first and uses fake sample data.
- Dispatch center API integration is planned for a future phase.
- Navigation structure is organized to support future mobile app expansion.
- Node.js 20.19.0+ is required (`.nvmrc` is included for version pinning).
