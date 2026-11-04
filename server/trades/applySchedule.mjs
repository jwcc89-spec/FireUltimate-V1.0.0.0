/**
 * Step 12: when a trade is accepted, split the schedule.
 * The other person covers the requested hours. Someone who already works the whole shift
 * and can fill a higher seat moves there for the entire shift, so that seat is not split.
 * Only the hours that still change people are split. The payback day uses the same rule.
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

function mergeIntervals(intervals) {
  const sorted = intervals.filter((interval) => interval.end > interval.start).sort((left, right) => left.start - right.start);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ start: interval.start, end: interval.end });
  }
  return merged;
}

function subtractInterval(intervals, start, end) {
  const next = [];
  for (const interval of intervals) {
    if (interval.end <= start || interval.start >= end) {
      next.push(interval);
      continue;
    }
    if (interval.start < start) next.push({ start: interval.start, end: start });
    if (interval.end > end) next.push({ start: end, end: interval.end });
  }
  return next;
}

function coversWindow(intervals, start, end) {
  return mergeIntervals(intervals).some((interval) => interval.start <= start && interval.end >= end);
}

function maxConcurrent(people, windowStart, windowEnd) {
  const events = [];
  for (const person of people) {
    for (const interval of person.intervals) {
      const start = Math.max(windowStart, interval.start);
      const end = Math.min(windowEnd, interval.end);
      if (end <= start) continue;
      events.push({ time: start, delta: 1 });
      events.push({ time: end, delta: -1 });
    }
  }
  events.sort((left, right) => left.time - right.time || left.delta - right.delta);
  let current = 0;
  let highest = 0;
  for (const event of events) {
    current += event.delta;
    if (current > highest) highest = current;
  }
  return highest;
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
    const intervals = new Map();
    const remember = (name) => {
      const key = String(name ?? "").trim().toLowerCase();
      if (!key) return null;
      if (!intervals.has(key)) intervals.set(key, { name: String(name).trim(), intervals: [] });
      return intervals.get(key);
    };
    for (const seat of onUnit) {
      const start = Math.max(windowStart, seat.start);
      const end = Math.min(windowEnd, seat.end);
      if (end > start) remember(seat.name).intervals.push({ start, end });
    }
    for (const person of intervals.values()) person.intervals = mergeIntervals(person.intervals);
    const leaver = [...intervals.values()].find((person) => sameName(person.name, leaverName));
    if (leaver) {
      leaver.intervals = subtractInterval(leaver.intervals, tradeStart, tradeEnd);
      if (leaver.intervals.length === 0) intervals.delete(leaver.name.toLowerCase());
    }
    const arriveStart = Math.max(windowStart, tradeStart);
    const arriveEnd = Math.min(windowEnd, tradeEnd);
    if (arriveEnd > arriveStart) {
      const arriver = remember(arriverName);
      arriver.intervals = mergeIntervals([...arriver.intervals, { start: arriveStart, end: arriveEnd }]);
    }

    const apparatus = apparatusByLabel.get(unitId);
    const rankedSeats = [...new Set(onUnit.map((seat) => seat.slotIndex))]
      .map((slotIndex) => ({
        slotIndex,
        rank: seatRank(apparatus, slotIndex, department.rankMap),
      }))
      .sort((left, right) => {
        const leftRank = left.rank === null ? Number.POSITIVE_INFINITY : left.rank;
        const rightRank = right.rank === null ? Number.POSITIVE_INFINITY : right.rank;
        return leftRank - rightRank || left.slotIndex - right.slotIndex;
      });
    const workers = [...intervals.values()];
    const fullShift = workers.filter((person) => coversWindow(person.intervals, windowStart, windowEnd));
    const partial = workers.filter((person) => !coversWindow(person.intervals, windowStart, windowEnd));
    const originalSeat = (name) => {
      const found = onUnit.filter((seat) => sameName(seat.name, name));
      if (found.length === 0) return 999;
      return Math.min(...found.map((seat) => seat.slotIndex));
    };
    fullShift.sort(
      (left, right) => originalSeat(left.name) - originalSeat(right.name) || left.name.localeCompare(right.name),
    );
    const stableCount = Math.min(
      fullShift.length,
      Math.max(0, rankedSeats.length - maxConcurrent(partial, windowStart, windowEnd)),
    );
    const stableSeats = rankedSeats.slice(0, stableCount);
    const flexSeats = rankedSeats.slice(stableCount);
    const stableAssigned =
      stableSeats.length === 0
        ? new Map()
        : assignPeopleToSeats(
            fullShift.map((person) => person.name),
            stableSeats,
            department.personnel,
            department.rankMap,
          );
    if (stableSeats.length > 0 && !stableAssigned) {
      return {
        ok: false,
        message: `Cannot assign ${arriverName}: does not meet required qualification for that segmented slot.`,
      };
    }

    const pieces = new Map();
    for (const [slotIndex, personName] of stableAssigned) {
      pieces.set(slotIndex, [{ name: personName, start: windowStart, end: windowEnd }]);
    }
    if (flexSeats.length > 0) {
      const points = new Set([windowStart, windowEnd]);
      for (const person of partial) {
        for (const interval of person.intervals) {
          if (interval.start > windowStart && interval.start < windowEnd) points.add(interval.start);
          if (interval.end > windowStart && interval.end < windowEnd) points.add(interval.end);
        }
      }
      const cuts = [...points].sort((left, right) => left - right);
      for (let index = 0; index < cuts.length - 1; index += 1) {
        const sliceStart = cuts[index];
        const sliceEnd = cuts[index + 1];
        const present = partial.filter((person) =>
          person.intervals.some((interval) => overlaps(sliceStart, sliceEnd, interval.start, interval.end)),
        );
        if (present.length === 0) continue;
        const assigned = assignPeopleToSeats(
          present.map((person) => person.name),
          flexSeats,
          department.personnel,
          department.rankMap,
        );
        if (!assigned) {
          return {
            ok: false,
            message: `Cannot assign ${arriverName}: does not meet required qualification for that segmented slot.`,
          };
        }
        for (const [slotIndex, personName] of assigned) {
          const list = pieces.get(slotIndex) ?? [];
          list.push({ name: personName, start: sliceStart, end: sliceEnd });
          pieces.set(slotIndex, list);
        }
      }
    }

    const slotSegments = parts.slotSegments;
    const assignments = parts.assignments;
    if (!Array.isArray(slotSegments[unitId])) slotSegments[unitId] = [];
    if (!Array.isArray(assignments[unitId])) assignments[unitId] = [];
    const flags = Array.isArray(parts.overtimeSplit[unitId]) ? [...parts.overtimeSplit[unitId]] : [];
    for (const seat of rankedSeats) {
      while (slotSegments[unitId].length <= seat.slotIndex) slotSegments[unitId].push([]);
      while (assignments[unitId].length <= seat.slotIndex) assignments[unitId].push("");
      while (flags.length <= seat.slotIndex) flags.push(false);
      const merged = mergeSegments(
        (pieces.get(seat.slotIndex) ?? []).map((piece) => ({
          id: `${tradeId}-${seat.slotIndex}-${piece.start}`,
          assigneeType: "personnel",
          personnelName: piece.name,
          startMinutes: piece.start,
          endMinutes: piece.end,
          source: "trade",
          overtime: false,
          tradeRef: tradeId,
        })),
      );
      const wholeShift =
        merged.length === 1 && merged[0].startMinutes <= windowStart && merged[0].endMinutes >= windowEnd;
      if (wholeShift) {
        assignments[unitId][seat.slotIndex] = merged[0].personnelName;
        slotSegments[unitId][seat.slotIndex] = [];
        flags[seat.slotIndex] = false;
      } else if (merged.length > 0) {
        assignments[unitId][seat.slotIndex] = merged[0].personnelName;
        slotSegments[unitId][seat.slotIndex] = merged;
        flags[seat.slotIndex] = true;
      }
    }
    parts.overtimeSplit[unitId] = flags;
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

/** Puts the saved pre-trade days back. Used when a cancellation is finally approved. */
export function rowsFromScheduleChange(scheduleChange) {
  const saved = Array.isArray(scheduleChange?.rows) ? scheduleChange.rows : [];
  const rows = [];
  for (const entry of saved) {
    const shiftType = String(entry?.shiftType ?? "").trim();
    const dateKey = String(entry?.dateKey ?? "").trim();
    const assignmentsJson = entry?.assignmentsJson;
    if (!shiftType || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !assignmentsJson || typeof assignmentsJson !== "object") {
      return {
        ok: false,
        message: "This trade was accepted before the previous schedule was saved, so it cannot be cancelled.",
      };
    }
    rows.push({
      shiftType,
      dateKey,
      assignmentsJson: structuredClone(assignmentsJson),
    });
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message: "This trade was accepted before the previous schedule was saved, so it cannot be cancelled.",
    };
  }
  return { ok: true, rows };
}
