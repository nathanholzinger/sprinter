import { useState, Fragment } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import EventCard from '../events/EventCard';
import EventForm from '../events/EventForm';
import { useTemplateStore } from '../../store/useTemplateStore';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const MIN_EVENT_HEIGHT = 24; // px
const EXPAND_STEP = 2;       // hours per expand click

// ─── Pure helpers (no component state) ───────────────────────────────────────

function timeStrToMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minsToTimeStr(totalMins) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Derive loopDayStart (clock hour 0–23).
 * Look LEFT from typicalDayStart; pick whichever is closer: midnight or typicalDayEnd.
 * Midnight wins on tie.
 */
function computeLoopDayStart(typicalDayStart, typicalDayEnd) {
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
function buildLoopDays(loopWeekStart) {
  const startIdx = DAYS.indexOf(loopWeekStart);
  return Array.from({ length: 7 }, (_, i) => ({
    dayNumber: i + 1,
    dayName: DAYS[(startIdx + i) % 7],
  }));
}

/** Convert a clock hour to loop-relative hours (0–23, where 0 = loopDayStart). */
function loopRelHoursOf(clockHour, loopDayStart) {
  return ((clockHour - loopDayStart) + 24) % 24;
}

/**
 * Convert typicalDayEnd to loop-relative hours for use as displayEnd.
 * Returns 24 when typicalDayEnd equals loopDayStart (full loop day).
 */
function loopRelEndOf(typicalDayEnd, typicalDayStart, loopDayStart) {
  if (typicalDayEnd === typicalDayStart) return 24;
  const rel = loopRelHoursOf(typicalDayEnd, loopDayStart);
  return rel === 0 ? 24 : rel;
}

/** Returns the dayNames a span event covers, in loop order. */
function getSpanDayNames(event, loopDays) {
  const startIdx = loopDays.findIndex((d) => d.dayName === event.startDay);
  const endIdx   = loopDays.findIndex((d) => d.dayName === event.endDay);
  return loopDays.slice(startIdx, endIdx + 1).map((d) => d.dayName);
}

/**
 * Assign colIdx and numCols to each card for side-by-side overlap rendering.
 * Mutates cards in-place; safe because cards are freshly created each render.
 */
function computeOverlapLayout(cards) {
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

function formatClockHour(clockH) {
  const h = ((clockH % 24) + 24) % 24;
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TemplateEditor({ templateId, onBack }) {
  const { state, dispatch } = useTemplateStore();
  const template = state.templates.find((t) => t.id === templateId);
  const { typicalDayStart, typicalDayEnd, loopWeekStart } = state.settings;

  const loopDayStart = computeLoopDayStart(typicalDayStart, typicalDayEnd);
  const loopDays = buildLoopDays(loopWeekStart);

  // displayStart / displayEnd are in loop-relative hours (0–24).
  // 0 = loopDayStart clock time, 24 = loopDayStart + 24h (end of loop day).
  const [displayStart, setDisplayStart] = useState(
    () => loopRelHoursOf(typicalDayStart, loopDayStart)
  );
  const [displayEnd, setDisplayEnd] = useState(
    () => loopRelEndOf(typicalDayEnd, typicalDayStart, loopDayStart)
  );

  const [formState, setFormState] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // { event, day } | null
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ typicalDayStart, typicalDayEnd, loopWeekStart });

  // ── Derived display values ─────────────────────────────────────────────────

  const totalHeight = (displayEnd - displayStart) * 60; // 1px per minute
  const windowSize  = displayEnd - displayStart;

  // loop-relative hour → clock hour
  const loopRelToClockHour = (relH) => (relH + loopDayStart) % 24;

  // clock minutes → loop-relative minutes
  const clockToLoopRelMins = (clockMins) =>
    ((clockMins - loopDayStart * 60) + 24 * 60) % (24 * 60);

  // Hours after midnight but before loopDayStart belong to the "next calendar day"
  // within the current loop day (shown with purple overlay + "+1" pill).
  const isNextCalDay = (loopRelH) => loopRelToClockHour(loopRelH) < loopDayStart;

  // Typical start/end in loop-relative hours (for grey-zone overlay)
  const typStartRel = loopRelHoursOf(typicalDayStart, loopDayStart);
  const typEndRel   = loopRelEndOf(typicalDayEnd, typicalDayStart, loopDayStart);
  const isGreyZone  = (loopRelH) => loopRelH < typStartRel || loopRelH >= typEndRel;

  // Hour ticks to render (loop-relative integers from displayStart up to displayEnd)
  const hourTicks = Array.from({ length: windowSize }, (_, i) => displayStart + i);

  // ── Not found guard ────────────────────────────────────────────────────────

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Template not found.{' '}
        <button onClick={onBack} className="ml-2 text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  // ── Card building ──────────────────────────────────────────────────────────

  /**
   * For a given loop day, return all cards that should render in that column.
   * An event belongs to a column if event.days includes the loop day's dayName.
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

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleSave(event) {
    if (formState?.id) {
      dispatch({ type: 'UPDATE_EVENT', templateId, event });
    } else {
      dispatch({ type: 'ADD_EVENT', templateId, event });
    }
    setFormState(null);
  }

  function handleDelete(eventId, dayName) {
    const event = template.events.find((e) => e.id === eventId);
    if ((event.type ?? 'recurring') === 'recurring' && event.days.length > 1) {
      setPendingDelete({ event, day: dayName });
    } else {
      dispatch({ type: 'DELETE_EVENT', templateId, eventId });
    }
  }

  function handleColumnClick(e, dayName) {
    if (e.target.closest('[data-event-card]')) return;
    setFormState({ defaultDay: dayName });
  }

  function handleSettingsSave() {
    dispatch({ type: 'SET_SETTINGS', settings: settingsForm });
    // Recompute loop-relative display window based on new settings
    const newLoopDayStart = computeLoopDayStart(settingsForm.typicalDayStart, settingsForm.typicalDayEnd);
    setDisplayStart(loopRelHoursOf(settingsForm.typicalDayStart, newLoopDayStart));
    setDisplayEnd(loopRelEndOf(settingsForm.typicalDayEnd, settingsForm.typicalDayStart, newLoopDayStart));
    setSettingsOpen(false);
  }

  // ── Expand buttons ─────────────────────────────────────────────────────────

  const canExpandEarlier = displayStart > 0;
  const canExpandLater   = displayEnd < 24;
  const earlierStep = Math.min(EXPAND_STEP, displayStart, 24 - windowSize);
  const laterStep   = Math.min(EXPAND_STEP, 24 - displayEnd, 24 - windowSize);

  const expandEarlierLabel = canExpandEarlier && earlierStep > 0
    ? `${formatClockHour(loopRelToClockHour(displayStart - earlierStep))} – ${formatClockHour(loopRelToClockHour(displayStart))}`
    : '';
  const expandLaterLabel = canExpandLater && laterStep > 0
    ? `${formatClockHour(loopRelToClockHour(displayEnd))} – ${formatClockHour(loopRelToClockHour(displayEnd + laterStep))}`
    : '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* App header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Back to templates"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{template.name}</h1>
          <p className="text-xs text-gray-400">Template editor</p>
        </div>
        <Button size="sm" onClick={() => setFormState({ defaultDay: loopDays[0].dayName })}>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Add event
        </Button>
      </div>

      <div className="min-w-[700px]">

        {/* Day header row — sticky below app header */}
        <div className="sticky top-[57px] z-10 flex bg-white border-b border-gray-200">
          <div className="w-14 shrink-0 flex items-center justify-center border-r border-gray-200">
            <button
              onClick={() => { setSettingsForm({ typicalDayStart, typicalDayEnd, loopWeekStart }); setSettingsOpen(true); }}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Calendar settings"
              title="Settings"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200">
            {loopDays.map((ld) => (
              <div key={ld.dayName} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {DAY_LABELS[ld.dayName]}
              </div>
            ))}
          </div>
        </div>

        {/* Expand earlier */}
        {canExpandEarlier && earlierStep > 0 && (
          <div className="flex border-b border-gray-200">
            <div className="w-14 shrink-0 border-r border-gray-200" />
            <button
              onClick={() => setDisplayStart((p) => p - earlierStep)}
              className="flex-1 py-1.5 flex items-center justify-center gap-1.5 text-xs text-gray-400 bg-gray-50 hover:bg-blue-50 hover:text-blue-500 transition-colors"
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
              </svg>
              Show {expandEarlierLabel}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex">

          {/* Time gutter */}
          <div className="relative w-14 shrink-0 select-none border-r border-gray-200" style={{ height: totalHeight }}>
            {hourTicks.map((relH) => (
              <div
                key={relH}
                className="absolute right-2 flex items-center gap-0.5"
                style={{ top: (relH - displayStart) * 60 - 7 }}
              >
                <span className={`text-xs leading-none ${isNextCalDay(relH) ? 'text-purple-400' : 'text-gray-400'}`}>
                  {formatClockHour(loopRelToClockHour(relH))}
                </span>
                {isNextCalDay(relH) && (
                  <span className="text-[9px] leading-none text-purple-400 font-semibold">+1</span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200 border-r border-gray-200">
            {loopDays.map((ld, colIdx) => (
              <div
                key={ld.dayName}
                className="relative cursor-pointer"
                style={{ height: totalHeight }}
                onClick={(e) => handleColumnClick(e, ld.dayName)}
              >
                {/* Hour overlays + grid lines */}
                {hourTicks.map((relH) => {
                  const y = (relH - displayStart) * 60;
                  const nextCal = isNextCalDay(relH);
                  const grey    = isGreyZone(relH);
                  return (
                    <Fragment key={relH}>
                      <div
                        className={`absolute left-0 right-0 pointer-events-none ${
                          grey ? 'bg-gray-100/60' : nextCal ? 'bg-purple-50/60' : ''
                        }`}
                        style={{ top: y, height: 60 }}
                      />
                      <div className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none" style={{ top: y }} />
                      <div className="absolute left-0 right-0 border-t border-gray-50 pointer-events-none"  style={{ top: y + 30 }} />
                    </Fragment>
                  );
                })}

                {/* Event cards */}
                {cardsByLoopDay[colIdx].map((card) => {
                  const visTopMins    = displayStart * 60;
                  const visBottomMins = displayEnd * 60;

                  // Clip the card to the visible window
                  const renderStart = Math.max(visTopMins, card.startLoopRel);
                  const renderEnd   = Math.min(visBottomMins, card.endLoopRel);
                  if (renderStart >= renderEnd) return null;

                  const top    = renderStart - visTopMins;
                  const height = Math.max(renderEnd - renderStart, MIN_EVENT_HEIGHT);

                  return (
                    <div
                      key={`${card.event.id}-${card.splitPart}`}
                      className="absolute"
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: `calc(${(card.colIdx / card.numCols) * 100}% + 2px)`,
                        width: `calc(${(1 / card.numCols) * 100}% - 4px)`,
                        zIndex: 1,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EventCard
                        event={card.event}
                        segmentStart={card.segmentStart}
                        segmentEnd={card.segmentEnd}
                        clippedTop={card.startLoopRel < visTopMins}
                        clippedBottom={card.endLoopRel > visBottomMins}
                        leftCount={card.leftCount}
                        rightCount={card.rightCount}
                        onEdit={(e) => setFormState(e)}
                        onDelete={(eventId) => handleDelete(eventId, loopDays[card.loopDayIdx].dayName)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

        </div>

        {/* Expand later */}
        {canExpandLater && laterStep > 0 && (
          <div className="flex border-t border-gray-200">
            <div className="w-14 shrink-0 border-r border-gray-200" />
            <button
              onClick={() => setDisplayEnd((p) => p + laterStep)}
              className="flex-1 py-1.5 flex items-center justify-center gap-1.5 text-xs text-gray-400 bg-gray-50 hover:bg-blue-50 hover:text-blue-500 transition-colors border-r border-gray-200"
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
              </svg>
              Show {expandLaterLabel}
            </button>
          </div>
        )}

      </div>

      {/* Event form modal */}
      {formState && (
        <EventForm
          initialEvent={formState.id ? formState : null}
          defaultDay={formState.defaultDay ?? formState.days?.[0] ?? loopDays[0].dayName}
          loopDays={loopDays}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}

      {/* Delete recurring event modal */}
      {pendingDelete && (
        <Modal title="Delete recurring event" onClose={() => setPendingDelete(null)}>
          <p className="text-sm text-gray-600 mb-5">
            <strong>{pendingDelete.event.title || 'This event'}</strong> repeats on multiple days.
            Do you want to remove it from <strong>{DAY_LABELS[pendingDelete.day]}</strong> only, or delete the entire series?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: 'REMOVE_EVENT_DAY', templateId, eventId: pendingDelete.event.id, day: pendingDelete.day });
                setPendingDelete(null);
              }}
            >
              {DAY_LABELS[pendingDelete.day]} only
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'DELETE_EVENT', templateId, eventId: pendingDelete.event.id });
                setPendingDelete(null);
              }}
            >
              Delete series
            </Button>
          </div>
        </Modal>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <Modal title="Calendar settings" onClose={() => setSettingsOpen(false)}>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day start</label>
                <select
                  value={settingsForm.typicalDayStart}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, typicalDayStart: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <option key={h} value={h}>{formatClockHour(h)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day end</label>
                <select
                  value={settingsForm.typicalDayEnd}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, typicalDayEnd: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <option key={h} value={h}>{formatClockHour(h)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week starts on</label>
              <select
                value={settingsForm.loopWeekStart}
                onChange={(e) => setSettingsForm((p) => ({ ...p, loopWeekStart: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              The calendar defaults to {formatClockHour(settingsForm.typicalDayStart)} – {formatClockHour(settingsForm.typicalDayEnd)}.
              Use expand buttons to reveal hours outside this range.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={handleSettingsSave}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
