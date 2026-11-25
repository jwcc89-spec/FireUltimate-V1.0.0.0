/**
 * Read-only lists the operations modules share (apparatus, stations, personnel), taken from
 * GET /api/department-details. Nothing here writes back to department details.
 */
import { useEffect, useState } from "react";

export interface ApparatusLookup {
  unitId: string;
  label: string;
  unitType: string;
}

export interface ModuleLookups {
  apparatus: ApparatusLookup[];
  stations: string[];
  personnel: string[];
  userFullNames: Record<string, string>;
}

const EMPTY_LOOKUPS: ModuleLookups = { apparatus: [], stations: [], personnel: [], userFullNames: {} };

type RawRecord = Record<string, unknown>;

function asRecords(raw: unknown): RawRecord[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is RawRecord => Boolean(entry) && typeof entry === "object") : [];
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0))).sort((a, b) => a.localeCompare(b));
}

/** Same source order as readApparatusFromDepartmentDetails in App.tsx: masterApparatusRecords, then legacy apparatusRecords. */
function readLookups(data: RawRecord): ModuleLookups {
  const master = asRecords(data.masterApparatusRecords);
  const apparatusSource = master.length > 0 ? master : asRecords(data.apparatusRecords);
  const seen = new Set<string>();
  const apparatus: ApparatusLookup[] = [];
  for (const record of apparatusSource) {
    const unitId = str(record.unitId);
    const commonName = str(record.commonName);
    const key = unitId || commonName;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    apparatus.push({
      unitId: key,
      label: commonName && commonName !== unitId && unitId ? `${unitId} - ${commonName}` : key,
      unitType: str(record.unitType),
    });
  }
  apparatus.sort((a, b) => a.unitId.localeCompare(b.unitId, undefined, { numeric: true }));

  const rawFullNames = data.userFullNames;
  const userFullNames: Record<string, string> = {};
  if (rawFullNames && typeof rawFullNames === "object" && !Array.isArray(rawFullNames)) {
    for (const [username, name] of Object.entries(rawFullNames as RawRecord)) {
      const fullName = str(name);
      if (username.trim() && fullName) userFullNames[username.trim().toLowerCase()] = fullName;
    }
  }

  return {
    apparatus,
    stations: uniqueSorted(asRecords(data.stationRecords).map((record) => str(record.name))),
    personnel: uniqueSorted([
      ...asRecords(data.schedulerPersonnelRecords).map((record) => str(record.name)),
      ...Object.values(userFullNames),
    ]),
    userFullNames,
  };
}

const LOOKUP_CACHE_MS = 60_000;
let cachedRequest: Promise<ModuleLookups> | null = null;
let cachedAt = 0;

function loadLookups(): Promise<ModuleLookups> {
  if (!cachedRequest || Date.now() - cachedAt > LOOKUP_CACHE_MS) {
    cachedAt = Date.now();
    cachedRequest = fetch("/api/department-details")
      .then(async (response) => {
        if (!response.ok) throw new Error("lookup failed");
        const json = (await response.json()) as { data?: RawRecord };
        return readLookups(json.data ?? {});
      })
      .catch(() => {
        cachedRequest = null;
        return EMPTY_LOOKUPS;
      });
  }
  return cachedRequest;
}

export function useModuleLookups(): ModuleLookups {
  const [lookups, setLookups] = useState<ModuleLookups>(EMPTY_LOOKUPS);
  useEffect(() => {
    let active = true;
    void loadLookups().then((next) => {
      if (active) setLookups(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return lookups;
}

export function fullNameForUsername(lookups: ModuleLookups, username: string): string {
  return lookups.userFullNames[username.trim().toLowerCase()] ?? username;
}
