# StationBoss Mimic (Web Prototype)

React + TypeScript prototype with the condensed menu structure and role-based
navigation.

## Current capabilities

- Auth screen (`/auth`) with simple login mode
- Admin/User role selection at login
- User role has access to all modules except **Admin Functions**
- Sidebar structure:
  - Dashboard
  - Incidents (Dispatches, Hydrants, Map View)
  - Reporting (NEIRS, EMS)
  - Personnel (Schedule, Certifications)
  - Apparatus (Units, Equipment List, Fuel Logs, Maintenance Logs, Mileage Logs)
  - Calendar (Events, Meetings)
  - File Center (Checklists, Daily Logs, E-Forms, Medical Supplies, Water Logs, Vendors, Resources)
  - Fire Prevention (Fire Investigations, Pre-Plans, Inspections, Permits, Properties, Smoke Alarms)
  - Training
  - Admin Functions (Scheduling, Overtime Hiring, Personnel Management, Point Tracker, Manage Groups, Expiration Tracker, Reports, Customization)
  - Messaging (View Messages, Create Message)
- Built-out module page:
  - Incidents -> Dispatches
- Settings gear menu (top right):
  - Profile Management
  - Edit My Display
  - Logout
- Admin Functions -> Customization page scaffold (logo upload + color controls)

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
