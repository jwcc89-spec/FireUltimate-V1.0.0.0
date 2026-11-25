/**
 * Default apparatus inspection seeded for each department. Item ids are stable: saved inspections
 * point at them, and an open deficiency on an item is shown on the next inspection of that unit.
 */
export const DEFAULT_INSPECTION_TEMPLATE_NAME = "Engine / Truck Apparatus Inspection";

const section = (id, title, labels, { defaultNa = false } = {}) => ({
  id,
  title,
  defaultNa,
  items: labels.map((label, index) => ({ id: `${id}-${index + 1}`, label })),
});

export const DEFAULT_INSPECTION_SECTIONS = [
  section("engine", "1. Engine", [
    "Engine oil level",
    "Coolant level",
    "Belts and hoses",
    "Air filter / restriction indicator",
    "Fuel level",
    "DEF level",
    "Leaks (oil, coolant, fuel)",
    "Exhaust system",
  ]),
  section("electrical", "2. Electrical", [
    "Batteries and connections",
    "Charging system / voltmeter",
    "Headlights and marker lights",
    "Brake, turn and backup lights",
    "Emergency warning lights",
    "Siren and air horn",
    "Scene and compartment lights",
    "Radios and mobile data terminal",
  ]),
  section("drivetrain", "3. Drive Train / Chassis", [
    "Transmission fluid level",
    "Service brakes",
    "Parking brake",
    "Air system pressure and drain",
    "Steering",
    "Tires (pressure and tread)",
    "Wheels and lug nuts",
    "Suspension",
  ]),
  section("body", "4. Body", [
    "Windshield and wipers",
    "Mirrors",
    "Doors, latches and compartments",
    "Steps and handrails",
    "Seat belts",
    "Body damage",
    "Ladder rack",
  ]),
  section("pump", "5. Pump Operation", [
    "Pump engages",
    "Primer",
    "Pump pressure and gauges",
    "Discharge and intake valves",
    "Relief valve / pressure governor",
    "Tank level gauge",
    "Water tank full",
    "Foam system",
  ]),
  section(
    "aerials",
    "6. Aerials",
    [
      "Hydraulic fluid level",
      "Outriggers / stabilizers",
      "Aerial raise, rotate and extend",
      "Aerial controls and interlocks",
      "Waterway",
      "Platform / tip controls",
    ],
    { defaultNa: true },
  ),
  section("special", "7. Special Equipment", [
    "Generator",
    "Hydraulic rescue tools",
    "Thermal imaging camera",
    "SCBA and spare cylinders",
    "Saws and power tools",
    "Portable lighting",
  ]),
  section("operation", "8. Operation and Performance", [
    "Starts normally",
    "Gauges and warning lights normal",
    "Shifts properly",
    "Brakes stop straight",
    "No unusual noises or vibration",
    "Road test complete",
  ]),
];
