# StationBoss Mimic (Web v1 Prototype)

React + TypeScript prototype that mirrors the StationBoss command layout with:

- Auth screen (`/auth`)
- Full primary module UIs:
  - Dashboard
  - Certifications
  - Checklists
  - Daily Logs
  - Dispatches
  - Equipment
  - Events
  - Fuel Logs
  - Incidents
  - Maintenance
  - Meetings
  - Messages
  - Personnel
  - Vendors
- Linked submenu routes for each module (scaffolded placeholders for future build-out)

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

- This v1 is UI-first and intended as a strong starting point for API integration.
- Navigation and route structure are organized to support future mobile expansion.
