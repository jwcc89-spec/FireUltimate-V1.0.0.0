# N13 — NERIS schema version and 1.5 gap list

**Date:** 2026-11-17, America/Chicago  
**Branch:** `submenu/neris-golive-cifpd`  
**Status:** Findings only. Do **not** change the NERIS form until the operator reviews this list.

---

## What version are we on?

| Source | What it says |
|--------|----------------|
| **Official NERIS site** | Schema **1.5.0** took effect **2026-10-01**. Platform release **1.5.1** published **2026-10-19**. Release notes: https://neris.fsri.org/release-notes |
| **Live production OpenAPI** (`https://api.neris.fsri.org/v1/openapi.json`) | `info.version` = **`1.5.3`** (checked 2026-11-17). The 1.5 fields are present in that file. |
| **Our app / database** | **No pinned NERIS schema version.** We do not store “1.4” or “1.5” in Postgres. Admin → NERIS Export Configuration has optional API version header name/value; both default to blank. Local `.env.server` points at `https://api-test.neris.fsri.org/v1`. Docs say production uses `https://api.neris.fsri.org/v1`. |
| **Our form metadata** (`src/nerisMetadata.ts`) | Built for the **pre–1.5** incident vocabulary. Almost every Schema 1.5 addition listed below is **missing** from our dropdowns and field list. |

**Plain English:** FireUltimate talks to the current NERIS **v1** API host. The national **data schema** that host expects is now **1.5.x**. Our screens still look like the earlier **1.4-era** field lists. Existing exports can keep working because 1.5 is additive (nothing new is required). We simply cannot pick the new types/fields until we add them.

### About “NERIS 2.0”

N13 was worded as “NERIS 2.0 documentation.” Official pages treat **Version 2** as a **future** release (planned for later in 2026), not the live schema. The live schema revision to compare against today is **1.5** (OpenAPI reports **1.5.3**). This findings file uses 1.5. When Version 2 ships, run a new comparison.

**Primary change list:** https://neris.fsri.org/articles/schema-v-1-5  
**Blog summary:** https://neris.fsri.org/blog/version-1-5  
**Technical reference:** https://neris.fsri.org/technical-reference

---

## What we checked in our project

- `src/nerisMetadata.ts` — form fields and enum lists  
- `server/neris-proxy.mjs` — `NERIS_BASE_URL`, no schema version constant  
- NERIS Export Configuration — optional version headers, empty by default  
- Staging/production `GET /api/neris/health` — both require sign-in (401), so base URL was not read live this session; trust env docs and OpenAPI  
- Live OpenAPI 1.5.3 vs our metadata for every item in the official 1.5 article  

---

## Gap list (1.5 additions we do not offer yet)

Everything below is in live OpenAPI 1.5.3 and in the official 1.5 article. None of these are required to stay valid. Add only what Crescent needs.

### New / changed incident types

| NERIS value | Plain name |
|-------------|------------|
| `FIRE\|\|TRANSPORTATION_FIRE\|\|VEHICLE_FIRE_AGRICULTURAL` | Agricultural vehicle fire |
| `MEDICAL\|\|INJURY\|\|MICRO_MOBILITY_VEHICLE_COLLISION` | Micromobility collision (e-bike, scooter, etc.) |
| `MEDICAL\|\|INJURY\|\|HUMAN_POWERED_VEHICLE_COLLISION` | Human-powered vehicle collision (bicycle, skateboard, etc.) |
| `RESCUE\|\|WATER\|\|ICE_RESCUE` | Ice rescue |
| `RESCUE\|\|WATER\|\|PERSON_IN_WATER_FLOOD` | Person in water — flood |
| `RESCUE\|\|WATER\|\|PERSON_IN_WATER_TIDAL_SURF` | Person in water — tidal / surf |
| `PUBSERV\|\|CITIZEN_ASSIST\|\|LEAK_FLOOD` | Water leak / flood (private side) |
| `PUBSERV\|\|CITIZEN_ASSIST\|\|OBSTRUCTION_DEBRIS` | Obstruction / debris (trees, non-energized wires, etc.) |
| `RESCUE\|\|TRANSPORTATION\|\|AVIATION_EMERGENCY` | Aviation emergency (Alert 2) |
| `HAZSIT\|\|HAZARD_NONCHEM\|\|ELEC_POWER_LINE_DOWN_ARCING_MALFUNC` | Power line down / arcing / malfunction (new granular value) |

We already have generic vehicle fire and motor vehicle collision types; 1.5 splits the more specific ones above.

### New base incident field

| Field | Meaning |
|-------|---------|
| `person_experiencing_homelessness` (boolean) | Response involved interaction with a person experiencing homelessness (not tied to location use) |

### Location use values (new)

`ASSEMBLY||POOL_AQUATIC_FACILITY`, `COMMERCIAL||DATA_CENTER`, `COMMERCIAL||FITNESS_GYMNASIUM`, `COMMERCIAL||MEGA_WAREHOUSE`, `INDUSTRIAL||AGRICULTURE_GREENHOUSE`, `INDUSTRIAL||AUTOMATED_STORAGE_RETRIEVAL`, `OUTDOOR||TIDAL_WATER`, `RESIDENTIAL||DETACHED_SINGLE_FAMILY_DWELLING`, `RESIDENTIAL||DETACHED_GARAGE`

### Location modifiers (new array)

`SHORT_TERM_RENTAL`, `EXCESSIVE_FUEL`, `HOARDING`  
(Note: we have something named `HOARDING_CONDITIONS` elsewhere; that is **not** this new location-modifier enum.)

### Special modifiers

| Value | Note |
|-------|------|
| `CIVIL_UNREST` | Added in 1.5 |
| `WORLD_CUP_2026` | Still in OpenAPI; NERIS blog says it is deprecated for new incidents after the event |

### Actions and tactics (new)

`CONTROL_UTILITIES`, `COMMAND_AND_CONTROL||RAPID_INTERVENTION_ESTABLISHED`, `EMERGENCY_MEDICAL_CARE||NO_PATIENT_EMS_SUPPORT`, `HAZARDOUS_SITUATION_MITIGATION||VEHICLE_ELECTRICAL_DISCONNECTION`, `…||VEHICLE_STABILIZATION`, `…||STRUCTURE_STABILIZATION`, `…||EARTH_STABILIZATION`, `LADDERS||GROUND_LADDER_USE`, `LADDERS||AERIAL_LADDER_USE`, `PROVIDE_SERVICES||ESTABLISH_LANDING_ZONE`

### Tactic timestamp (new)

| Field | Meaning |
|-------|---------|
| `tactic_timestamps.rapid_intervention_established` | When RIT was established |

### Fire module

| Change | Detail |
|--------|--------|
| `violated_local_ordinance` | Outside fire violated a local ordinance (e.g. burn ban) |
| Damage values `AFFECTED`, `INACCESSIBLE` | Added alongside existing damage levels |
| `INVESTIGATED_BY_FIRE_AND_EXPLOSION_INVESTIGATOR` | Preferred new wording; OpenAPI still lists the older `INVESTIGATED_BY_ARSON_FIRE_INVESTIGATOR` (we still only list the older one) |
| `AERIAL_MASTER_STREAM` | New suppression appliance |
| `PLUG_IN_PHOTOVOLTAICS` | New PV / powergen hazard type |

### Entity (department stations / units)

| Field | Meaning |
|-------|---------|
| `stations[].in_service` | Station online/offline without deleting the NERIS ID |
| `stations[].units[].in_service` | Unit online/offline the same way |

Not for real-time availability; for renovations, seasonal moves, etc.

### Incident analysis only

| Field | Meaning |
|-------|---------|
| `outside_fire.fuel_group` | Grass, shrub, timber litter, slash, non-burnable, etc. (analysis schema; needs specialized knowledge) |
| Matching location / damage / ordinance sync | Same 1.5 location and damage updates mirrored into analysis |

We do not currently build a separate Incident Analysis export UI for these.

---

## Suggested next steps (operator chooses)

1. **Rename N13 in the priority list** from “NERIS 2.0” to “NERIS Schema 1.5 (OpenAPI 1.5.3)” so the wording matches reality.  
2. **Pick Crescent-relevant 1.5 values first** (likely: micromobility / human-powered collision if those calls happen, `person_experiencing_homelessness`, non-patient EMS support, RIT timestamp, civil unrest only if needed).  
3. **Then** approve a small batch to add those enums/fields to `nerisMetadata.ts` + form/print/required-fields parity. Do not bulk-add everything without a product pass.  
4. When NERIS publishes **Version 2**, run a fresh OpenAPI diff.

---

## Sources checked

- https://neris.fsri.org/release-notes  
- https://neris.fsri.org/technical-reference/1-5-0  
- https://neris.fsri.org/technical-reference/1-5-1  
- https://neris.fsri.org/articles/schema-v-1-5  
- https://neris.fsri.org/blog/version-1-5  
- https://neris.fsri.org/blog/what-chiefs-need-to-know-about-neris-and-the-new-shape-of-fire-data (Version 2 planned later)  
- https://api.neris.fsri.org/v1/openapi.json (`info.version` = 1.5.3)  
- Repo: `src/nerisMetadata.ts`, NERIS export settings, `.env.server` base URL only  
