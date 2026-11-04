/**
 * Step 12: when a trade is accepted, split the schedule.
 * The other person covers the requested hours. Someone already on that truck can move
 * into a higher seat when they hold that qualification. The payback day swaps the same hours.
 * scheduleChangeJson keeps the previous day so a later cancel can put it back.
 */

import {
  allApparatusPlacements,
  assignPeopleToSeats,
  readTradeDepartment,
  scheduleSnapshotFromRows,
  seatRank,
  shiftWindow,
  tradeInterval,
  tradeRequestBlockReasonFromStored,
} from "./eligibility.mjs";

function overlaps(start, end, otherStart, otherEnd) {
  return Math.max(start, otherStart) < Math.min(end, otherEnd);
}

function sameName(left, right) {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function namesInSlot(value) {
  if (typeof value !== "string") return [];
  return value
    .split("||OT||")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unwrap(row) {
  const payload = row?.assignmentsJson && typeof row.assignmentsJson === "object" ? row.assignmentsJson : {};
  const assignments =
    payload.assignments && typeof payload.assignments === "object" ? payload.assignments : payload;
  const overtimeSplit =
    payload.overtimeSplit && typeof payload.overtimeSplit === "object" ? payload.overtimeSplit : {};
  const slotSegments =
    payload.slotSegments && typeof payload.slotSegments === "object" ? payload.slotSegments : {};
  return { assignments, overtimeSplit, slotSegments };
}

function cloneRows(rows) {
  return (rows ?? []).map((row) => ({
    shiftType: row.shiftType,
    dateKey: row.dateKey,
    assignmentsJson: structuredClone(row.assignmentsJson ?? {}),
  }));
}

function mergeSegments(segments) {
  const sorted = [...segments].sort(
    (left, right) =>
      left.startMinutes - right.startMinutes || left.personnelName.localeCompare(right.personnelName),
  );
  const merged = [];
  for (const segment of sorted) {
    if (!(segment.endMinutes > segment.startMinutes)) continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.personnelName === segment.personnelName &&
      last.source === segment.source &&
      last.tradeRef === segment.tradeRef &&
      last.endMinutes === segment.startMinutes
    ) {
      last.endMinutes = segment.endMinutes;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}

function baseSegments(slotValue, stored, windowStart, windowEnd) {
  const real = (Array.isArray(stored) ? stored : []).filter(
    (segment) =>
      segment &&
      segment.assigneeType !== "hire" &&
      segment.source !== "auto_hire" &&
      String(segment.personnelName ?? "").trim() &&
      Number(segment.endMinutes) > Number(segment.startMinutes),
  );
  if (real.length > 0) {
    return real.map((segment) => ({
      ...segment,
      personnelName: String(segment.personnelName).trim(),
      startMinutes: Number(segment.startMinutes),
      endMinutes: Number(segment.endMinutes),
    }));
  }
  const name = namesInSlot(slotValue)[0] ?? "";
  if (!name) return [];
  return [
    {
      id: `shift-${name}-${windowStart}`,
      assigneeType: "personnel",
      personnelName: name,
      startMinutes: windowStart,
      endMinutes: windowEnd,
      source: "manual",
      overtime: false,
    },
  ];
}

function replaceRange(segments, start, end, personName, tradeId) {
  const next = [];
  for (const segment of segments) {
    const hits = segment.endMinutes > start && segment.startMinutes < end;
    if (!hits) {
      next.push(segment);
      continue;
    }
    if (segment.startMinutes < start) {
      next.push({
        ...segment,
        id: `${tradeId}-before-${segment.startMinutes}`,
        endMinutes: start,
        source: "trade",
        tradeRef: tradeId,
      });
    }
    if (segment.endMinutes > end) {
      next.push({
        ...segment,
        id: `${tradeId}-after-${end}`,
        startMinutes: end,
        source: "trade",
        tradeRef: tradeId,
      });
    }
  }
  next.push({
    id: `${tradeId}-${personName}-${start}`,
    assigneeType: "personnel",
    personnelName: personName,
    startMinutes: start,
    endMinutes: end,
    source: "trade",
    overtime: false,
    tradeRef: tradeId,
  });
  return mergeSegments(next);
}

function coverDay(rows, department, originals, cover) {
  const { dateKey, leaverName, arriverName, startTime, endTime, tradeId } = cover;
  const snapshot = scheduleSnapshotFromRows(rows);
  const [tradeStart, tradeEnd] = tradeInterval(startTime, endTime);
  const leaverSeats = allApparatusPlacements(
    dateKey,
    snapshot.assignments,
    snapshot.slotSegments,
    department.shiftEntries,
  ).filter(
    (seat) => sameName(seat.name, leaverName) && overlaps(tradeStart, tradeEnd, seat.start, seat.end),
  );
  if (leaverSeats.length === 0) {
    return {
      ok: false,
      message: `${leaverName} is not scheduled on ${dateKey}, so this trade cannot be placed.`,
    };
  }
  const apparatusByLabel = new Map(department.apparatus.map((entry) => [entry.label, entry]));
  const units = [...new Set(leaverSeats.map((seat) => `${seat.shiftType}::${seat.unitId}`))];
  for (const unitKey of units) {
    const splitAt = unitKey.indexOf("::");
    const shiftType = unitKey.slice(0, splitAt);
    const unitId = unitKey.slice(splitAt + 2);
    const row = rows.find((entry) => entry.shiftType === shiftType && entry.dateKey === dateKey);
    if (!row) {
      return { ok: false, message: `${leaverName} is not scheduled on ${dateKey}, so this trade cannot be placed.` };
    }
    const originalKey = `${shiftType}::${dateKey}`;
    if (!originals.has(originalKey)) originals.set(originalKey, structuredClone(row.assignmentsJson ?? {}));
    const parts = unwrap(row);
    const [windowStart, windowEnd] = shiftWindow(shiftType, department.shiftEntries);
    const onUnit = allApparatusPlacements(
      dateKey,
      { [`${shiftType}::${dateKey}`]: parts.assignments },
      { [`${shiftType}::${dateKey}`]: parts.slotSegments },
      department.shiftEntries,
    ).filter((seat) => seat.unitId === unitId);
    const leaverSlots = [
      ...new Set(
        onUnit
          .filter((seat) => sameName(seat.name, leaverName) && overlaps(tradeStart, tradeEnd, seat.start, seat.end))
          .map((seat) => seat.slotIndex),
      ),
    ];
    const points = new Set([tradeStart, tradeEnd]);
    for (const seat of onUnit) {
      if (seat.start > tradeStart && seat.start < tradeEnd) points.add(seat.start);
      if (seat.end > tradeStart && seat.end < tradeEnd) points.add(seat.end);
    }
    const cuts = [...points].sort((left, right) => left - right);
    const slotSegments = parts.slotSegments;
    if (!Array.isArray(slotSegments[unitId])) slotSegments[unitId] = [];
    const assignments = parts.assignments;
    if (!Array.isArray(assignments[unitId])) assignments[unitId] = [];
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const sliceStart = cuts[index];
      const sliceEnd = cuts[index + 1];
      const present = onUnit.filter((seat) => overlaps(sliceStart, sliceEnd, seat.start, seat.end));
      const seatIndexes = new Set(leaverSlots);
      const people = [];
      const seen = new Set();
      const addPerson = (name) => {
        const key = String(name ?? "").trim().toLowerCase();
        if (!key || seen.has(key) || sameName(name, leaverName)) return;
        seen.add(key);
        people.push(String(name).trim());
      };
      for (const seat of present) {
        if (!sameName(seat.name, leaverName)) seatIndexes.add(seat.slotIndex);
        addPerson(seat.name);
      }
      addPerson(arriverName);
      const seats = [...seatIndexes]
        .sort((left, right) => left - right)
        .map((slotIndex) => ({
          slotIndex,
          rank: seatRank(apparatusByLabel.get(unitId), slotIndex, department.rankMap),
        }));
      const assigned = assignPeopleToSeats(people, seats, department.personnel, department.rankMap);
      if (!assigned) {
        return {
          ok: false,
          message: `Cannot assign ${arriverName}: does not meet required qualification for that segmented slot.`,
        };
      }
      for (const [slotIndex, personName] of assigned) {
        while (slotSegments[unitId].length <= slotIndex) slotSegments[unitId].push([]);
        while (assignments[unitId].length <= slotIndex) assignments[unitId].push("");
        const current = baseSegments(
          assignments[unitId][slotIndex],
          slotSegments[unitId][slotIndex],
          windowStart,
          windowEnd,
        );
        slotSegments[unitId][slotIndex] = replaceRange(current, sliceStart, sliceEnd, personName, tradeId);
        assignments[unitId][slotIndex] = slotSegments[unitId][slotIndex][0]?.personnelName ?? personName;
        const flags = Array.isArray(parts.overtimeSplit[unitId]) ? [...parts.overtimeSplit[unitId]] : [];
        while (flags.length <= slotIndex) flags.push(false);
        flags[slotIndex] = true;
        parts.overtimeSplit[unitId] = flags;
      }
    }
    row.assignmentsJson = parts;
  }
  return { ok: true };
}

export function applyAcceptedTrade({ payload, rows, trade }) {
  const department = readTradeDepartment(payload);
  const block = tradeRequestBlockReasonFromStored({
    payload,
    rows,
    requesterName: trade.requesterName,
    counterpartName: trade.counterpartName,
    tradeDate: trade.tradeDate,
    startTime: trade.startTime,
    endTime: trade.endTime,
  });
  if (block) return { ok: false, message: block };

  const working = cloneRows(rows);
  const originals = new Map();
  const placed = coverDay(working, department, originals, {
    dateKey: trade.tradeDate,
    leaverName: trade.requesterName,
    arriverName: trade.counterpartName,
    startTime: trade.startTime,
    endTime: trade.endTime,
    tradeId: trade.id,
  });
  if (!placed.ok) return placed;

  if (trade.paybackRequired && trade.paybackDate) {
    const paybackBlock = tradeRequestBlockReasonFromStored({
      payload,
      rows: working,
      requesterName: trade.counterpartName,
      counterpartName: trade.requesterName,
      tradeDate: trade.paybackDate,
      startTime: trade.startTime,
      endTime: trade.endTime,
    });
    if (paybackBlock) return { ok: false, message: `On the payback date, ${paybackBlock}` };
    const payback = coverDay(working, department, originals, {
      dateKey: trade.paybackDate,
      leaverName: trade.counterpartName,
      arriverName: trade.requesterName,
      startTime: trade.startTime,
      endTime: trade.endTime,
      tradeId: trade.id,
    });
    if (!payback.ok) return { ok: false, message: `On the payback date, ${payback.message}` };
  }

  const changed = [];
  const previous = [];
  for (const [key, assignmentsJson] of originals) {
    const [shiftType, dateKey] = key.split("::");
    const row = working.find((entry) => entry.shiftType === shiftType && entry.dateKey === dateKey);
    changed.push({ shiftType, dateKey, assignmentsJson: row.assignmentsJson });
    previous.push({ shiftType, dateKey, assignmentsJson });
  }
  return { ok: true, rows: changed, scheduleChange: { rows: previous } };
}
