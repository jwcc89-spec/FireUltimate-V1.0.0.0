/**
 * Pre-plan fields. Every field is optional. Answers are saved as { fieldId: text }, so fields can be added
 * or reworded here without a database change. Keep field ids stable once departments have saved answers.
 * The Complex template gets the ESO field list later.
 */
import type { PrePlanTemplate } from "../../api/prevention";

export interface PrePlanField {
  id: string;
  label: string;
  kind: "text" | "textarea" | "choice";
  options?: string[];
  wide?: boolean;
}

export interface PrePlanSection {
  id: string;
  title: string;
  complexOnly?: boolean;
  fields: PrePlanField[];
}

const YES_NO = ["Yes", "No", "Unknown"];

export const PRE_PLAN_SECTIONS: PrePlanSection[] = [
  {
    id: "building",
    title: "Building",
    fields: [
      {
        id: "constructionType",
        label: "Construction Type",
        kind: "choice",
        options: [
          "Type I - Fire Resistive",
          "Type II - Non-combustible",
          "Type III - Ordinary",
          "Type IV - Heavy Timber",
          "Type V - Wood Frame",
          "Unknown",
        ],
      },
      { id: "storiesAbove", label: "Stories Above Grade", kind: "text" },
      { id: "storiesBelow", label: "Stories Below Grade", kind: "text" },
      { id: "roofType", label: "Roof Type", kind: "choice", options: ["Flat", "Pitched", "Bowstring Truss", "Other", "Unknown"] },
      { id: "basement", label: "Basement", kind: "choice", options: YES_NO },
    ],
  },
  {
    id: "access",
    title: "Access",
    fields: [
      { id: "primaryEntrance", label: "Primary Entrance", kind: "text" },
      { id: "knoxBox", label: "Knox Box Location", kind: "text" },
      { id: "gateAccess", label: "Gate / Door Access", kind: "text" },
      { id: "accessNotes", label: "Access Notes", kind: "textarea", wide: true },
    ],
  },
  {
    id: "fireProtection",
    title: "Fire Protection",
    fields: [
      { id: "sprinklers", label: "Sprinklers", kind: "choice", options: ["Full", "Partial", "None", "Unknown"] },
      { id: "fdcLocation", label: "FDC Location", kind: "text" },
      { id: "standpipe", label: "Standpipe", kind: "choice", options: YES_NO },
      { id: "alarmPanel", label: "Fire Alarm Panel Location", kind: "text" },
      { id: "nearestHydrant", label: "Nearest Hydrant", kind: "text" },
    ],
  },
  {
    id: "utilities",
    title: "Utility Shutoffs",
    fields: [
      { id: "gasShutoff", label: "Gas", kind: "text" },
      { id: "electricShutoff", label: "Electric", kind: "text" },
      { id: "waterShutoff", label: "Water", kind: "text" },
    ],
  },
  {
    id: "hazards",
    title: "Hazards",
    fields: [{ id: "hazards", label: "Hazards", kind: "textarea", wide: true }],
  },
  {
    id: "occupancy",
    title: "Occupancy",
    complexOnly: true,
    fields: [
      { id: "occupancyHours", label: "Hours of Operation", kind: "text" },
      { id: "occupantLoad", label: "Occupant Load", kind: "text" },
      { id: "specialPopulations", label: "Special Populations (non-ambulatory, children...)", kind: "textarea", wide: true },
    ],
  },
  {
    id: "construction",
    title: "Construction Details",
    complexOnly: true,
    fields: [
      { id: "wallConstruction", label: "Walls", kind: "text" },
      { id: "roofConstruction", label: "Roof Construction", kind: "text" },
      { id: "trussType", label: "Trusses", kind: "choice", options: ["None", "Wood", "Steel", "Unknown"] },
      { id: "ceilingType", label: "Ceilings / Attic", kind: "text" },
      { id: "solarPanels", label: "Solar Panels", kind: "choice", options: YES_NO },
      { id: "batteryStorage", label: "Battery Storage", kind: "choice", options: YES_NO },
      { id: "elevators", label: "Elevators", kind: "text" },
    ],
  },
  {
    id: "fireProtectionDetails",
    title: "Fire Protection Details",
    complexOnly: true,
    fields: [
      { id: "sprinklerType", label: "Sprinkler System Type", kind: "choice", options: ["Wet", "Dry", "Pre-action", "Deluge", "Other"] },
      { id: "riserLocation", label: "Riser Room Location", kind: "text" },
      { id: "firePump", label: "Fire Pump", kind: "choice", options: YES_NO },
      { id: "firePumpLocation", label: "Fire Pump Location", kind: "text" },
      { id: "kitchenHood", label: "Kitchen Hood System", kind: "choice", options: YES_NO },
      { id: "alarmCompany", label: "Alarm Company", kind: "text" },
      { id: "alarmCompanyPhone", label: "Alarm Company Phone", kind: "text" },
    ],
  },
  {
    id: "hazmat",
    title: "Hazardous Materials",
    complexOnly: true,
    fields: [
      { id: "hazmatPresent", label: "Hazardous Materials Present", kind: "choice", options: YES_NO },
      { id: "tierTwo", label: "Tier II Reporting Facility", kind: "choice", options: YES_NO },
      { id: "sdsLocation", label: "SDS Location", kind: "text" },
      { id: "hazmatList", label: "Materials and Quantities", kind: "textarea", wide: true },
    ],
  },
  {
    id: "tactical",
    title: "Tactical",
    complexOnly: true,
    fields: [
      { id: "requiredFireFlow", label: "Required Fire Flow (GPM)", kind: "text" },
      { id: "waterSupply", label: "Water Supply", kind: "text" },
      { id: "apparatusPlacement", label: "Apparatus Placement", kind: "textarea", wide: true },
      { id: "stagingArea", label: "Staging Area", kind: "text" },
      { id: "afterHoursContact", label: "After-Hours Contact", kind: "text" },
      { id: "ventilationNotes", label: "Ventilation Notes", kind: "textarea", wide: true },
    ],
  },
  {
    id: "notes",
    title: "Notes",
    fields: [{ id: "notes", label: "Notes", kind: "textarea", wide: true }],
  },
];

export function sectionsFor(template: PrePlanTemplate): PrePlanSection[] {
  return PRE_PLAN_SECTIONS.filter((section) => template === "complex" || !section.complexOnly);
}

export function templateLabel(template: string): string {
  return template === "complex" ? "Complex" : "Basic";
}
