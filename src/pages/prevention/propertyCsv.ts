/** CSV template, reader and header mapping for the property import. */

export const IMPORT_COLUMNS: { key: string; header: string; example: string }[] = [
  { key: "name", header: "Occupant or Business Name", example: "Maple Street Market" },
  { key: "address", header: "Address", example: "401 Maple St" },
  { key: "unit", header: "Suite / Unit / Lot", example: "" },
  { key: "city", header: "City", example: "Crescent City" },
  { key: "state", header: "State", example: "IL" },
  { key: "postalCode", header: "Postal Code", example: "60928" },
  { key: "propertyType", header: "Property Type", example: "Commercial" },
  { key: "occupancyType", header: "Occupancy Type", example: "Mercantile" },
  { key: "squareFeet", header: "Square Feet", example: "4200" },
  { key: "yearBuilt", header: "Year Built", example: "1978" },
  { key: "latitude", header: "Latitude", example: "" },
  { key: "longitude", header: "Longitude", example: "" },
  { key: "notes", header: "Notes", example: "" },
  { key: "ownerFirstName", header: "Owner First Name", example: "Pat" },
  { key: "ownerLastName", header: "Owner Last Name", example: "Smith" },
  { key: "ownerBusinessName", header: "Owner Business Name", example: "" },
  { key: "ownerPhone", header: "Owner Phone", example: "815-555-0100" },
  { key: "ownerEmail", header: "Owner Email", example: "" },
];

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<string, string> = {
  occupant: "name",
  businessname: "name",
  street: "address",
  streetaddress: "address",
  suite: "unit",
  apt: "unit",
  zip: "postalCode",
  zipcode: "postalCode",
  type: "propertyType",
  occupancy: "occupancyType",
  sqft: "squareFeet",
  squarefootage: "squareFeet",
  lat: "latitude",
  lng: "longitude",
  lon: "longitude",
  long: "longitude",
};

const HEADER_TO_KEY = new Map<string, string>([
  ...IMPORT_COLUMNS.flatMap((column) => [
    [squash(column.header), column.key] as [string, string],
    [squash(column.key), column.key] as [string, string],
  ]),
  ...Object.entries(ALIASES),
]);

function quote(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function templateCsv(): string {
  return [IMPORT_COLUMNS.map((column) => quote(column.header)).join(","), IMPORT_COLUMNS.map((column) => quote(column.example)).join(",")].join(
    "\r\n",
  );
}

/** RFC 4180-style reader: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(source: string): string[][] {
  const textValue = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < textValue.length; index += 1) {
    const char = textValue[index];
    if (inQuotes) {
      if (char === '"') {
        if (textValue[index + 1] === '"') {
          field += '"';
          index += 1;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && textValue[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** First row is headers. Unknown columns are listed so the user can see what was skipped. */
export function rowsFromCsv(source: string): { rows: Record<string, string>[]; unknownHeaders: string[] } {
  const [headers = [], ...body] = parseCsv(source);
  const keys = headers.map((header) => HEADER_TO_KEY.get(squash(header)) ?? "");
  const unknownHeaders = headers.filter((header, index) => !keys[index] && header.trim() !== "");
  const rows = body.map((cells) => {
    const entry: Record<string, string> = {};
    keys.forEach((key, index) => {
      if (key && cells[index] !== undefined) entry[key] = cells[index].trim();
    });
    return entry;
  });
  return { rows, unknownHeaders };
}
