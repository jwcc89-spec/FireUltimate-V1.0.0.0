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
  - Reporting (NEIRS, EMS)
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
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Notes

- This version is UI-first and uses fake sample data.
- Dispatch center API integration is planned for a future phase.
- Navigation structure is organized to support future mobile app expansion.
