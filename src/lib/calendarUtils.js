export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export function timeStrToMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minsToTimeStr(totalMins) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Derive loopDayStart (clock hour 0–23).
 * Look LEFT from typicalDayStart; pick whichever is closer: midnight or typicalDayEnd.
 * Midnight wins on tie.
 */
export function computeLoopDayStart(typicalDayStart, typicalDayEnd) {
  const distMidnight = typicalDayStart;
  const distEnd =
    typicalDayEnd < typicalDayStart
      ? typicalDayStart - typicalDayEnd
      : typicalDayStart + (24 - typicalDayEnd);
  return distMidnight <= distEnd ? 0 : typicalDayEnd;
}

/**
 * Build the ordered loop-day array.
 * loopDay[0] starts on loopWeekStart and each subsequent day follows in week order.
 * Returns [{ dayNumber: 1, dayName: 'monday' }, ...]
 */
export function buildLoopDays(loopWeekStart) {
  const startIdx = DAYS.indexOf(loopWeekStart);
  return Array.from({ length: 7 }, (_, i) => ({
    dayNumber: i + 1,
    dayName: DAYS[(startIdx + i) % 7],
  }));
}

/** Convert a clock hour to loop-relative hours (0–23, where 0 = loopDayStart). */
export function loopRelHoursOf(clockHour, loopDayStart) {
  return ((clockHour - loopDayStart) + 24) % 24;
}

/**
 * Convert typicalDayEnd to loop-relative hours for use as displayEnd.
 * Returns 24 when typicalDayEnd equals loopDayStart (full loop day).
 */
export function loopRelEndOf(typicalDayEnd, typicalDayStart, loopDayStart) {
  if (typicalDayEnd === typicalDayStart) return 24;
  const rel = loopRelHoursOf(typicalDayEnd, loopDayStart);
  return rel === 0 ? 24 : rel;
}

/** Returns the dayNames a span event covers, in loop order. */
export function getSpanDayNames(event, loopDays) {
  const startIdx = loopDays.findIndex((d) => d.dayName === event.startDay);
  const endIdx   = loopDays.findIndex((d) => d.dayName === event.endDay);
  return loopDays.slice(startIdx, endIdx + 1).map((d) => d.dayName);
}

/**
 * Assign colIdx and numCols to each card for side-by-side overlap rendering.
 * Mutates cards in-place; safe because cards are freshly created each render.
 */
export function computeOverlapLayout(cards) {
  if (cards.length === 0) return cards;

  cards.sort((a, b) =>
    a.startLoopRel !== b.startLoopRel
      ? a.startLoopRel - b.startLoopRel
      : a.endLoopRel - b.endLoopRel
  );

  const clusters = [];
  let current = [];
  let maxEnd = -Infinity;

  for (const card of cards) {
    if (current.length > 0 && card.startLoopRel >= maxEnd) {
      clusters.push(current);
      current = [];
      maxEnd = -Infinity;
    }
    current.push(card);
    if (card.endLoopRel > maxEnd) maxEnd = card.endLoopRel;
  }
  if (current.length > 0) clusters.push(current);

  for (const cluster of clusters) {
    const laneEnds = [];
    for (const card of cluster) {
      let placed = false;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= card.startLoopRel) {
          card.colIdx = i;
          laneEnds[i] = card.endLoopRel;
          placed = true;
          break;
        }
      }
      if (!placed) {
        card.colIdx = laneEnds.length;
        laneEnds.push(card.endLoopRel);
      }
    }
    const numCols = laneEnds.length;
    for (const card of cluster) card.numCols = numCols;
  }

  return cards;
}

export function formatClockHour(clockH) {
  const h = ((clockH % 24) + 24) % 24;
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
