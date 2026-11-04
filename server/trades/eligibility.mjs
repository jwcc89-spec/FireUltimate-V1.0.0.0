/**
 * Step 11: refuse a trade before it is saved.
 * The other person must be free for those hours and off Injury / Vacation / Sick / Kelly Day.
 * Qualification looks at the whole truck for those hours. A person in a lower seat can move
 * up when their qualification covers the seat being given up, and the new person must meet
 * the seat that move opens. Messages match the schedule screen.
 */

const LEAVE_IDS = new Set([
  "support-injured",
  "support-vacation",
  "support-sick",
  "support-kelly-day",
]);

const LEAVE_NAMES = new Set(["injury", "injured", "vacation", "sick", "kelly day"]);

const DEFAULT_LEAVE_LABEL = {
  "support-injured": "Injury",
  "support-vacation": "Vacation",
  "support-sick": "Sick",
  "support-kelly-day": "Kelly Day",
};

function sameName(left, right) {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function namesInSlot(value) {
  if (typeof value === "string") {
    return value
      .split("||OT||")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((entry) => namesInSlot(entry));
  return [];
}

function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return 0;
  const hours = Math.max(0, Math.min(23, Number.parseInt(match[1], 10) || 0));
  const minutes = Math.max(0, Math.min(59, Number.parseInt(match[2], 10) || 0));
  return hours * 60 + minutes;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function tradeInterval(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);
  if (end <= start) end += 1440;
  return [start, end];
}

function shiftWindow(shiftType, shiftEntries) {
  const entry = shiftEntries.find((item) => item.shiftType === shiftType);
  const start = parseTimeToMinutes(entry?.startTime ?? "");
  const hours = Math.floor(Number(entry?.shiftDuration) || 24);
  const duration = Math.max(60, (hours > 0 ? hours : 24) * 60);
  return [start, start + duration];
}

function storageDate(storageKey) {
  const marker = "::";
  const index = storageKey.lastIndexOf(marker);
  if (index < 0) return { shiftType: "", dateKey: "" };
  return {
    shiftType: storageKey.slice(0, index),
    dateKey: storageKey.slice(index + marker.length),
  };
}

function bestRank(person, rankMap) {
  if (!person || !Array.isArray(person.qualifications) || person.qualifications.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  let best = Number.POSITIVE_INFINITY;
  for (const qualification of person.qualifications) {
    if (rankMap.has(qualification)) best = Math.min(best, rankMap.get(qualification));
  }
  return best;
}

function leaveLabel(unitId, additionalFields) {
  const id = String(unitId ?? "").trim();
  const field = additionalFields.find((entry) => entry.id === id);
  const name = String(field?.fieldName ?? DEFAULT_LEAVE_LABEL[id] ?? "").trim();
  const nameKey = name.toLowerCase();
  if (LEAVE_IDS.has(id) || LEAVE_NAMES.has(nameKey)) return name || DEFAULT_LEAVE_LABEL[id] || "that row";
  return "";
}

function personListed(personName, slots, segmentRows) {
  const slotList = Array.isArray(slots) ? slots : [];
  if (slotList.some((slot) => namesInSlot(slot).some((name) => sameName(name, personName)))) return true;
  const rows = Array.isArray(segmentRows) ? segmentRows : [];
  return rows.some((segments) =>
    Array.isArray(segments)
      ? segments.some((segment) => sameName(segment?.personnelName, personName))
      : false,
  );
}

/** Apparatus time on one date. Support rows are not work seats. */
function allApparatusPlacements(dateKey, assignments, slotSegments, shiftEntries) {
  const placements = [];
  for (const [storageKey, day] of Object.entries(assignments ?? {})) {
    const parsed = storageDate(storageKey);
    if (parsed.dateKey !== dateKey) continue;
    const [windowStart, windowEnd] = shiftWindow(parsed.shiftType, shiftEntries);
    const daySegments = slotSegments?.[storageKey] ?? {};
    const unitIds = new Set([
      ...Object.keys(day && typeof day === "object" ? day : {}),
      ...Object.keys(daySegments && typeof daySegments === "object" ? daySegments : {}),
    ]);
    for (const unitId of unitIds) {
      if (unitId.startsWith("support-")) continue;
      const slots = Array.isArray(day?.[unitId]) ? day[unitId] : [];
      const segRows = Array.isArray(daySegments?.[unitId]) ? daySegments[unitId] : [];
      const count = Math.max(slots.length, segRows.length);
      for (let slotIndex = 0; slotIndex < count; slotIndex += 1) {
        const segments = Array.isArray(segRows[slotIndex]) ? segRows[slotIndex] : [];
        const namesWithSegments = new Set();
        for (const segment of segments) {
          const name = String(segment?.personnelName ?? "").trim();
          if (
            !name ||
            segment?.assigneeType === "hire" ||
            segment?.source === "auto_hire" ||
            !(Number(segment?.endMinutes) > Number(segment?.startMinutes))
          ) {
            continue;
          }
          namesWithSegments.add(name.toLowerCase());
          placements.push({
            unitId,
            slotIndex,
            name,
            start: Number(segment.startMinutes),
            end: Number(segment.endMinutes),
          });
        }
        for (const name of namesInSlot(slots[slotIndex])) {
          if (namesWithSegments.has(name.toLowerCase())) continue;
          placements.push({
            unitId,
            slotIndex,
            name,
            start: windowStart,
            end: windowEnd,
          });
        }
      }
    }
  }
  placements.sort(
    (left, right) =>
      left.unitId.localeCompare(right.unitId) ||
      left.slotIndex - right.slotIndex ||
      left.name.localeCompare(right.name),
  );
  return placements;
}

function apparatusPlacements(personName, dateKey, assignments, slotSegments, shiftEntries) {
  return allApparatusPlacements(dateKey, assignments, slotSegments, shiftEntries).filter((seat) =>
    sameName(seat.name, personName),
  );
}

function seatRank(apparatus, slotIndex, rankMap) {
  if (!apparatus || slotIndex >= apparatus.minimumPersonnel) return null;
  const required = String(apparatus.personnelRequirements[slotIndex] ?? "").trim();
  if (!required) return null;
  return rankMap.has(required) ? rankMap.get(required) : Number.POSITIVE_INFINITY;
}

/** True when the people can fill these seats, strictest seat first. A null rank is any person. */
function crewCanFillSeats(people, seatRanks, personnel, rankMap) {
  const ranks = people.map((name) => bestRank(personnel.find((entry) => sameName(entry.name, name)), rankMap));
  const strict = seatRanks
    .map((rank, index) => ({ rank, index }))
    .filter((seat) => seat.rank !== null)
    .sort((left, right) => left.rank - right.rank);
  const used = new Set();
  for (const seat of strict) {
    let selected = null;
    let selectedRank = Number.POSITIVE_INFINITY;
    ranks.forEach((rank, index) => {
      if (used.has(index)) return;
      if (Number.isFinite(rank) && rank <= seat.rank && rank < selectedRank) {
        selected = index;
        selectedRank = rank;
      }
    });
    if (selected === null) return false;
    used.add(selected);
  }
  const openSeats = seatRanks.filter((rank) => rank === null).length;
  return ranks.length - used.size >= openSeats;
}

function qualificationMessage({
  requester,
  counterpart,
  tradeDate,
  tradeStart,
  tradeEnd,
  personnel,
  rankMap,
  apparatusByLabel,
  assignments,
  slotSegments,
  shiftEntries,
}) {
  const placements = allApparatusPlacements(tradeDate, assignments, slotSegments, shiftEntries);
  const requesterUnits = [
    ...new Set(
      placements
        .filter(
          (seat) =>
            sameName(seat.name, requester) &&
            intervalsOverlap(tradeStart, tradeEnd, seat.start, seat.end),
        )
        .map((seat) => seat.unitId),
    ),
  ].sort((left, right) => left.localeCompare(right));

  for (const unitId of requesterUnits) {
    const onUnit = placements.filter((seat) => seat.unitId === unitId);
    const requesterSeats = [
      ...new Set(
        onUnit
          .filter(
            (seat) =>
              sameName(seat.name, requester) &&
              intervalsOverlap(tradeStart, tradeEnd, seat.start, seat.end),
          )
          .map((seat) => seat.slotIndex),
      ),
    ];
    const points = new Set([tradeStart, tradeEnd]);
    for (const seat of onUnit) {
      if (seat.start > tradeStart && seat.start < tradeEnd) points.add(seat.start);
      if (seat.end > tradeStart && seat.end < tradeEnd) points.add(seat.end);
    }
    const cuts = [...points].sort((left, right) => left - right);
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const sliceStart = cuts[index];
      const sliceEnd = cuts[index + 1];
      const present = onUnit.filter((seat) => intervalsOverlap(sliceStart, sliceEnd, seat.start, seat.end));
      const seats = new Set(requesterSeats);
      const people = [];
      const seen = new Set();
      const addPerson = (name) => {
        const key = String(name ?? "").trim().toLowerCase();
        if (!key || seen.has(key) || sameName(name, requester)) return;
        seen.add(key);
        people.push(String(name).trim());
      };
      for (const seat of present) {
        if (!sameName(seat.name, requester)) seats.add(seat.slotIndex);
        addPerson(seat.name);
      }
      addPerson(counterpart);
      const seatRanks = [...seats]
        .sort((left, right) => left - right)
        .map((slotIndex) => seatRank(apparatusByLabel.get(unitId), slotIndex, rankMap));
      if (!crewCanFillSeats(people, seatRanks, personnel, rankMap)) {
        return `Cannot assign ${counterpart}: does not meet required qualification for that segmented slot.`;
      }
    }
  }
  return "";
}

/**
 * @returns {string} Empty when the request may be saved. Otherwise the notice text.
 */
export function tradeRequestBlockReason({
  requesterName,
  counterpartName,
  tradeDate,
  startTime,
  endTime,
  personnel = [],
  qualificationOrder = [],
  apparatus = [],
  additionalFields = [],
  shiftEntries = [],
  assignments = {},
  slotSegments = {},
}) {
  const counterpart = String(counterpartName ?? "").trim();
  const requester = String(requesterName ?? "").trim();
  if (!counterpart || !requester || !tradeDate) return "";
  const [tradeStart, tradeEnd] = tradeInterval(startTime, endTime);
  const rankMap = new Map();
  qualificationOrder.forEach((qualification, index) => {
    const label = String(qualification ?? "").trim();
    if (label && !rankMap.has(label)) rankMap.set(label, index);
  });
  const apparatusByLabel = new Map(apparatus.map((entry) => [entry.label, entry]));

  for (const [storageKey, day] of Object.entries(assignments ?? {})) {
    if (storageDate(storageKey).dateKey !== tradeDate) continue;
    const daySegments = slotSegments?.[storageKey] ?? {};
    const unitIds = new Set([
      ...Object.keys(day && typeof day === "object" ? day : {}),
      ...Object.keys(daySegments && typeof daySegments === "object" ? daySegments : {}),
    ]);
    const labels = [...unitIds]
      .map((unitId) => ({ unitId, label: leaveLabel(unitId, additionalFields) }))
      .filter((entry) => entry.label)
      .sort((left, right) => left.label.localeCompare(right.label));
    for (const entry of labels) {
      if (personListed(counterpart, day?.[entry.unitId], daySegments?.[entry.unitId])) {
        return `${counterpart} is on ${entry.label}. Remove them from ${entry.label} before scheduling them on apparatus.`;
      }
    }
  }

  const overlap = apparatusPlacements(
    counterpart,
    tradeDate,
    assignments,
    slotSegments,
    shiftEntries,
  ).find((seat) => intervalsOverlap(tradeStart, tradeEnd, seat.start, seat.end));
  if (overlap) {
    return `${counterpart} already assigned to ${overlap.unitId}. Remove or segment assignments so times do not overlap.`;
  }
  return qualificationMessage({
    requester,
    counterpart,
    tradeDate,
    tradeStart,
    tradeEnd,
    personnel,
    rankMap,
    apparatusByLabel,
    assignments,
    slotSegments,
    shiftEntries,
  });
}

export function scheduleSnapshotFromRows(rows) {
  const assignments = {};
  const slotSegments = {};
  for (const row of rows ?? []) {
    const shiftType = String(row?.shiftType ?? "").trim();
    const dateKey = String(row?.dateKey ?? "").trim();
    if (!shiftType || !dateKey) continue;
    const storageKey = `${shiftType}::${dateKey}`;
    const payload =
      row.assignmentsJson && typeof row.assignmentsJson === "object" ? row.assignmentsJson : {};
    const rowAssignments =
      payload.assignments && typeof payload.assignments === "object" ? payload.assignments : payload;
    const rowSlotSegments =
      payload.slotSegments && typeof payload.slotSegments === "object" ? payload.slotSegments : {};
    assignments[storageKey] = rowAssignments;
    slotSegments[storageKey] = rowSlotSegments;
  }
  return { assignments, slotSegments };
}

function apparatusFromPayload(payload) {
  const records = Array.isArray(payload.schedulerApparatusRecords) ? payload.schedulerApparatusRecords : [];
  return records
    .map((record) => {
      const label = String(record?.apparatus ?? "").trim();
      const slotCount = Math.max(
        1,
        Math.floor(Number(record?.maximumPersonnel ?? record?.minimumPersonnel) || 0),
      );
      const minimumPersonnel = Math.min(
        Math.max(0, Math.floor(Number(record?.minimumPersonnel) || 0)),
        slotCount,
      );
      const personnelRequirements = Array.isArray(record?.personnelRequirements)
        ? record.personnelRequirements.map((entry) => String(entry ?? "").trim())
        : [];
      return { label, minimumPersonnel, personnelRequirements };
    })
    .filter((entry) => entry.label);
}

export function tradeRequestBlockReasonFromStored({
  payload,
  rows,
  requesterName,
  counterpartName,
  tradeDate,
  startTime,
  endTime,
}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const personnel = (Array.isArray(source.schedulerPersonnelRecords) ? source.schedulerPersonnelRecords : [])
    .map((record) => ({
      name: String(record?.name ?? "").trim(),
      qualifications: Array.isArray(record?.qualifications)
        ? record.qualifications.map((entry) => String(entry ?? "").trim()).filter(Boolean)
        : [],
    }))
    .filter((entry) => entry.name);
  const additionalFields = (Array.isArray(source.additionalFields) ? source.additionalFields : [])
    .map((record) => ({
      id: String(record?.id ?? "").trim(),
      fieldName: String(record?.fieldName ?? "").trim(),
    }))
    .filter((entry) => entry.id || entry.fieldName);
  const shiftEntries = (Array.isArray(source.shiftInformationEntries) ? source.shiftInformationEntries : [])
    .map((record) => ({
      shiftType: String(record?.shiftType ?? "").trim(),
      startTime: String(record?.startTime ?? "").trim(),
      shiftDuration: Number(record?.shiftDuration) || 0,
    }))
    .filter((entry) => entry.shiftType);
  const qualificationOrder = Array.isArray(source.personnelQualifications)
    ? source.personnelQualifications.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];
  return tradeRequestBlockReason({
    requesterName,
    counterpartName,
    tradeDate,
    startTime,
    endTime,
    personnel,
    qualificationOrder,
    apparatus: apparatusFromPayload(source),
    additionalFields,
    shiftEntries,
    ...scheduleSnapshotFromRows(rows),
  });
}
