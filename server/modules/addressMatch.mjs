/**
 * Cleans a street address so the same building matches however it was typed:
 * "401 Maple Street, Apt 2, Watseka IL" and "401 maple st" both become "401 MAPLE ST".
 * Used for call history, the NERIS "Add from Properties" picker and import duplicate warnings.
 */

const WORDS = new Map(
  Object.entries({
    STREET: "ST",
    STR: "ST",
    AVENUE: "AVE",
    AV: "AVE",
    ROAD: "RD",
    DRIVE: "DR",
    LANE: "LN",
    COURT: "CT",
    BOULEVARD: "BLVD",
    HIGHWAY: "HWY",
    ROUTE: "RT",
    RTE: "RT",
    PLACE: "PL",
    CIRCLE: "CIR",
    PARKWAY: "PKWY",
    TERRACE: "TER",
    TRAIL: "TRL",
    SQUARE: "SQ",
    CENTER: "CTR",
    CENTRE: "CTR",
    EXPRESSWAY: "EXPY",
    NORTH: "N",
    SOUTH: "S",
    EAST: "E",
    WEST: "W",
    NORTHEAST: "NE",
    NORTHWEST: "NW",
    SOUTHEAST: "SE",
    SOUTHWEST: "SW",
  }),
);

const UNIT_PATTERN = /\b(APT|APARTMENT|UNIT|STE|SUITE|LOT|BLDG|BUILDING|RM|ROOM|FL|FLOOR|TRLR|SPACE|SPC)\b\.?\s*[A-Z0-9-]*|#\s*[A-Z0-9-]+/g;

export function normalizeAddress(value) {
  const firstPart = String(value ?? "").split(",")[0] ?? "";
  const cleaned = firstPart
    .toUpperCase()
    .replace(UNIT_PATTERN, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => WORDS.get(word) ?? word)
    .join(" ");
  return cleaned.slice(0, 300);
}
