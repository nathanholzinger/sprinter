import {
  timeStrToMins, minsToTimeStr,
  getSpanDayNames, computeOverlapLayout,
} from '../lib/calendarUtils';

/**
 * Transforms a template's events into per-column card objects ready for rendering.
 *
 * Returns cardsByLoopDay: an array of 7 arrays (one per loop day), each containing
 * card objects with positioning data (startLoopRel, endLoopRel, colIdx, numCols, etc.).
 */
export function useCardLayout({ template, loopDays, loopDayStart }) {
  // clock minutes → loop-relative minutes (0 = loopDayStart)
  function clockToLoopRelMins(clockMins) {
    return ((clockMins - loopDayStart * 60) + 24 * 60) % (24 * 60);
  }

  /**
   * For a given loop day, return all cards that should render in that column.
   * Events that cross the loop day boundary (24 loop-relative hours) are split
   * into two cards: one for this column, one for the next.
   */
  function getCardsForLoopDay(loopDay) {
    const loopDayIdx = loopDays.findIndex((d) => d.dayName === loopDay.dayName);
    const cards = [];

    for (const event of template.events) {
      const eventType = event.type ?? 'recurring';

      if (eventType === 'recurring') {
        if (!event.days.includes(loopDay.dayName)) continue;

        const startLoopRel = clockToLoopRelMins(timeStrToMins(event.startTime));
        let endLoopRel     = clockToLoopRelMins(timeStrToMins(event.endTime));

        // Overnight: if end ≤ start in loop-relative space, the event wraps into
        // the next loop day — shift end forward by a full day.
        if (endLoopRel <= startLoopRel) {
          endLoopRel += 24 * 60;
        }

        const crossesBoundary = startLoopRel < 24 * 60 && endLoopRel > 24 * 60;

        if (crossesBoundary) {
          const boundaryTimeStr = minsToTimeStr(loopDayStart * 60);
          const nextIdx = (loopDayIdx + 1) % 7;

          cards.push({
            event, loopDayIdx, startLoopRel, endLoopRel: 24 * 60,
            segmentStart: event.startTime, segmentEnd: boundaryTimeStr, splitPart: 1,
            leftCount: 0, rightCount: 1,
          });
          cards.push({
            event, loopDayIdx: nextIdx, startLoopRel: 0, endLoopRel: endLoopRel - 24 * 60,
            segmentStart: boundaryTimeStr, segmentEnd: event.endTime, splitPart: 2,
            leftCount: 1, rightCount: 0,
          });
        } else {
          cards.push({
            event, loopDayIdx, startLoopRel, endLoopRel,
            segmentStart: undefined, segmentEnd: undefined, splitPart: 0,
            leftCount: 0, rightCount: 0,
          });
        }

      } else if (eventType === 'span') {
        const spanDays = getSpanDayNames(event, loopDays);
        if (!spanDays.includes(loopDay.dayName)) continue;

        const isSameDay  = event.startDay === event.endDay;
        const isStartDay = loopDay.dayName === event.startDay;
        const isEndDay   = loopDay.dayName === event.endDay;
        const startLoopRel  = clockToLoopRelMins(timeStrToMins(event.startTime));
        const endLoopRelRaw = clockToLoopRelMins(timeStrToMins(event.endTime));

        let cardStartRel, cardEndRel, segStart, segEnd;

        if (isSameDay) {
          cardStartRel = startLoopRel;
          cardEndRel   = endLoopRelRaw <= startLoopRel ? endLoopRelRaw + 24 * 60 : endLoopRelRaw;
          segStart = undefined; segEnd = undefined;
        } else if (isStartDay) {
          cardStartRel = startLoopRel; cardEndRel = 24 * 60;
          segStart = event.startTime; segEnd = minsToTimeStr(loopDayStart * 60);
        } else if (isEndDay) {
          cardStartRel = 0; cardEndRel = endLoopRelRaw;
          segStart = minsToTimeStr(loopDayStart * 60); segEnd = event.endTime;
        } else {
          // Middle day — full column
          cardStartRel = 0; cardEndRel = 24 * 60;
          segStart = undefined; segEnd = undefined;
        }

        const spanStartIdx = loopDays.findIndex((d) => d.dayName === event.startDay);
        const spanEndIdx   = loopDays.findIndex((d) => d.dayName === event.endDay);
        cards.push({
          event, loopDayIdx,
          startLoopRel: cardStartRel, endLoopRel: cardEndRel,
          segmentStart: segStart, segmentEnd: segEnd,
          splitPart: 0,
          leftCount: loopDayIdx - spanStartIdx,
          rightCount: spanEndIdx - loopDayIdx,
        });
      }
    }

    return cards;
  }

  // Distribute all cards into per-column buckets, then assign overlap layout.
  const cardsByLoopDay = Array.from({ length: 7 }, () => []);
  for (const loopDay of loopDays) {
    for (const card of getCardsForLoopDay(loopDay)) {
      cardsByLoopDay[card.loopDayIdx].push(card);
    }
  }
  cardsByLoopDay.forEach(computeOverlapLayout);

  return cardsByLoopDay;
}
