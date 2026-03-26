import { useState, Fragment } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import EventCard from '../events/EventCard';
import EventForm from '../events/EventForm';
import SettingsModal from './SettingsModal';
import { useTemplateStore, createEvent } from '../../store/useTemplateStore';
import {
  DAY_LABELS,
  computeLoopDayStart, buildLoopDays,
  loopRelHoursOf, loopRelEndOf,
  formatClockHour,
} from '../../lib/calendarUtils';
import { useDragToCreate } from '../../hooks/useDragToCreate';
import { useDragToMove } from '../../hooks/useDragToMove';
import { useDragToResize } from '../../hooks/useDragToResize';
import { useCardLayout } from '../../hooks/useCardLayout';

const MIN_EVENT_HEIGHT = 24; // px
const EXPAND_STEP = 2;       // hours per expand click

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
  const [pendingMove, setPendingMove] = useState(null);     // { card, targetColIdx, newStartTime, newEndTime } | null
  const [pendingResize, setPendingResize] = useState(null); // { card, newStartTime, newEndTime } | null
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Derived display values ─────────────────────────────────────────────────

  const totalHeight = (displayEnd - displayStart) * 60; // 1px per minute
  const windowSize  = displayEnd - displayStart;

  // ── Drag-to-create ────────────────────────────────────────────────────────
  const { dragPreview, handleColumnMouseDown } = useDragToCreate({
    loopDayStart, loopDays, displayStart, totalHeight, setFormState,
  });

  // ── Drag-to-move ──────────────────────────────────────────────────────────

  function handleCardMove(card, targetColIdx, newStartTime, newEndTime) {
    const event = card.event;
    if ((event.type ?? 'recurring') !== 'recurring') return;
    if (event.days.length > 1) {
      setPendingMove({ card, targetColIdx, newStartTime, newEndTime });
    } else {
      dispatch({ type: 'UPDATE_EVENT', templateId, event: { ...event, startTime: newStartTime, endTime: newEndTime, days: [loopDays[targetColIdx].dayName] } });
    }
  }

  const { draggingKey, dragMovePreview, handleCardMouseDown } = useDragToMove({
    loopDayStart, loopDays, displayStart, totalHeight, onMove: handleCardMove,
  });

  // ── Drag-to-resize ────────────────────────────────────────────────────────

  function handleCardResize(card, newStartTime, newEndTime) {
    const event = card.event;
    if ((event.type ?? 'recurring') !== 'recurring') return;
    if (event.days.length > 1) {
      setPendingResize({ card, newStartTime, newEndTime });
    } else {
      dispatch({ type: 'UPDATE_EVENT', templateId, event: { ...event, startTime: newStartTime, endTime: newEndTime } });
    }
  }

  const { resizingKey, resizePreview, handleResizeMouseDown } = useDragToResize({
    loopDayStart, loopDays, displayStart, totalHeight, onResize: handleCardResize,
  });

  // loop-relative hour → clock hour
  const loopRelToClockHour = (relH) => (relH + loopDayStart) % 24;

  // Hours after midnight but before loopDayStart belong to the "next calendar day"
  // within the current loop day (shown with purple overlay + "+1" pill).
  const isNextCalDay = (loopRelH) => loopRelToClockHour(loopRelH) < loopDayStart;

  // Typical start/end in loop-relative hours (for grey-zone overlay)
  const typStartRel = loopRelHoursOf(typicalDayStart, loopDayStart);
  const typEndRel   = loopRelEndOf(typicalDayEnd, typicalDayStart, loopDayStart);
  const isGreyZone  = (loopRelH) => loopRelH < typStartRel || loopRelH >= typEndRel;

  // Hour ticks to render (loop-relative integers from displayStart up to displayEnd)
  const hourTicks = Array.from({ length: windowSize }, (_, i) => displayStart + i);

  // ── Card building ──────────────────────────────────────────────────────────

  const cardsByLoopDay = useCardLayout({ template, loopDays, loopDayStart });

  // ── Not found guard ────────────────────────────────────────────────────────

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Template not found.{' '}
        <button onClick={onBack} className="ml-2 text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

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

  function handleSettingsSave(newSettings) {
    dispatch({ type: 'SET_SETTINGS', settings: newSettings });
    const newLoopDayStart = computeLoopDayStart(newSettings.typicalDayStart, newSettings.typicalDayEnd);
    setDisplayStart(loopRelHoursOf(newSettings.typicalDayStart, newLoopDayStart));
    setDisplayEnd(loopRelEndOf(newSettings.typicalDayEnd, newSettings.typicalDayStart, newLoopDayStart));
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
              onClick={() => setSettingsOpen(true)}
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
                data-day-idx={colIdx}
                className={`relative select-none ${draggingKey ? 'cursor-grabbing' : resizingKey ? 'cursor-ns-resize' : dragPreview ? 'cursor-crosshair' : 'cursor-pointer'}`}
                style={{ height: totalHeight }}
                onMouseDown={(e) => handleColumnMouseDown(e, colIdx)}
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

                {/* Drag-to-create ghost preview */}
                {dragPreview && colIdx >= dragPreview.startDayIdx && colIdx <= dragPreview.endDayIdx && (() => {
                  const { startDayIdx, startLoopRelMins, endDayIdx, endLoopRelMins } = dragPreview;
                  const isSingle = startDayIdx === endDayIdx;
                  const ghostStart = isSingle || colIdx === startDayIdx ? startLoopRelMins : 0;
                  const ghostEnd   = isSingle || colIdx === endDayIdx   ? endLoopRelMins   : 24 * 60;
                  const visTop     = displayStart * 60;
                  const visBottom  = displayEnd * 60;
                  const rStart = Math.max(visTop, ghostStart);
                  const rEnd   = Math.min(visBottom, ghostEnd);
                  if (rStart >= rEnd) return null;
                  return (
                    <div
                      key="ghost"
                      className="absolute pointer-events-none"
                      style={{ top: rStart - visTop + 1, height: Math.max(rEnd - rStart, MIN_EVENT_HEIGHT) - 2, left: 2, right: 2, zIndex: 2 }}
                    >
                      <div className="h-full rounded-lg border-2 border-dashed border-blue-400 bg-blue-100/50" />
                    </div>
                  );
                })()}

                {/* Drag-to-move ghost */}
                {dragMovePreview && dragMovePreview.colIdx === colIdx && (() => {
                  const { startLoopRelMins, endLoopRelMins, event } = dragMovePreview;
                  const visTop    = displayStart * 60;
                  const visBottom = displayEnd   * 60;
                  const rStart = Math.max(visTop, startLoopRelMins);
                  const rEnd   = Math.min(visBottom, endLoopRelMins);
                  if (rStart >= rEnd) return null;
                  return (
                    <div
                      key="move-ghost"
                      className="absolute pointer-events-none"
                      style={{ top: rStart - visTop + 1, height: Math.max(rEnd - rStart, MIN_EVENT_HEIGHT) - 2, left: 2, right: 2, zIndex: 3 }}
                    >
                      <div className="h-full rounded-lg border-2 border-blue-400 bg-blue-200/70 shadow-md flex flex-col px-2 py-1 overflow-hidden">
                        <span className="truncate text-xs font-semibold text-blue-900 leading-snug">
                          {event.title || <span className="italic text-blue-500">Untitled</span>}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Drag-to-resize ghost */}
                {resizePreview && resizePreview.colIdx === colIdx && (() => {
                  const { startLoopRelMins, endLoopRelMins, event } = resizePreview;
                  const visTop    = displayStart * 60;
                  const visBottom = displayEnd   * 60;
                  const rStart = Math.max(visTop, startLoopRelMins);
                  const rEnd   = Math.min(visBottom, endLoopRelMins);
                  if (rStart >= rEnd) return null;
                  return (
                    <div
                      key="resize-ghost"
                      className="absolute pointer-events-none"
                      style={{ top: rStart - visTop + 1, height: Math.max(rEnd - rStart, MIN_EVENT_HEIGHT) - 2, left: 2, right: 2, zIndex: 3 }}
                    >
                      <div className="h-full rounded-lg border-2 border-blue-400 bg-blue-200/70 shadow-md flex flex-col px-2 py-1 overflow-hidden">
                        <span className="truncate text-xs font-semibold text-blue-900 leading-snug">
                          {event.title || <span className="italic text-blue-500">Untitled</span>}
                        </span>
                      </div>
                    </div>
                  );
                })()}

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
                  const cardKey     = `${card.event.id}-${card.splitPart}`;
                  const isDraggable = (card.event.type ?? 'recurring') !== 'span' && card.splitPart === 0;

                  return (
                    <div
                      key={cardKey}
                      className={`absolute ${isDraggable ? 'cursor-grab' : ''}`}
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: `calc(${(card.colIdx / card.numCols) * 100}% + 2px)`,
                        width: `calc(${(1 / card.numCols) * 100}% - 4px)`,
                        zIndex: 1,
                      }}
                      onMouseDown={(e) => {
                        const resizeHandle = e.target.closest('[data-resize-handle]');
                        if (resizeHandle) {
                          handleResizeMouseDown(e, card, colIdx, resizeHandle.dataset.resizeHandle);
                        } else {
                          handleCardMouseDown(e, card, colIdx);
                        }
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
                        dragging={draggingKey === cardKey || resizingKey === cardKey}
                        resizable={isDraggable}
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
          defaultStartTime={formState.startTime}
          defaultEndTime={formState.endTime}
          defaultType={formState.defaultType}
          defaultSpanStartDay={formState.defaultSpanStartDay}
          defaultSpanEndDay={formState.defaultSpanEndDay}
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

      {/* Move recurring event modal */}
      {pendingMove && (() => {
        const { card, targetColIdx, newStartTime, newEndTime } = pendingMove;
        const event   = card.event;
        const dayName = loopDays[card.loopDayIdx].dayName;
        return (
          <Modal title="Move recurring event" onClose={() => setPendingMove(null)}>
            <p className="text-sm text-gray-600 mb-5">
              <strong>{event.title || 'This event'}</strong> repeats on multiple days.
              Do you want to move <strong>{DAY_LABELS[dayName]}</strong> only to{' '}
              <strong>{newStartTime} – {newEndTime}</strong>, or move the entire series?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingMove(null)}>Cancel</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  dispatch({ type: 'REMOVE_EVENT_DAY', templateId, eventId: event.id, day: dayName });
                  dispatch({ type: 'ADD_EVENT', templateId, event: createEvent({ title: event.title, notes: event.notes, days: [loopDays[targetColIdx].dayName], startTime: newStartTime, endTime: newEndTime }) });
                  setPendingMove(null);
                }}
              >
                {DAY_LABELS[dayName]} only
              </Button>
              <Button
                onClick={() => {
                  dispatch({ type: 'UPDATE_EVENT', templateId, event: { ...event, startTime: newStartTime, endTime: newEndTime } });
                  setPendingMove(null);
                }}
              >
                Move all days
              </Button>
            </div>
          </Modal>
        );
      })()}

      {/* Resize recurring event modal */}
      {pendingResize && (() => {
        const { card, newStartTime, newEndTime } = pendingResize;
        const event   = card.event;
        const dayName = loopDays[card.loopDayIdx].dayName;
        return (
          <Modal title="Resize recurring event" onClose={() => setPendingResize(null)}>
            <p className="text-sm text-gray-600 mb-5">
              <strong>{event.title || 'This event'}</strong> repeats on multiple days.
              Do you want to adjust <strong>{DAY_LABELS[dayName]}</strong> only to{' '}
              <strong>{newStartTime} – {newEndTime}</strong>, or adjust the entire series?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingResize(null)}>Cancel</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  dispatch({ type: 'REMOVE_EVENT_DAY', templateId, eventId: event.id, day: dayName });
                  dispatch({ type: 'ADD_EVENT', templateId, event: createEvent({ title: event.title, notes: event.notes, days: [dayName], startTime: newStartTime, endTime: newEndTime }) });
                  setPendingResize(null);
                }}
              >
                {DAY_LABELS[dayName]} only
              </Button>
              <Button
                onClick={() => {
                  dispatch({ type: 'UPDATE_EVENT', templateId, event: { ...event, startTime: newStartTime, endTime: newEndTime } });
                  setPendingResize(null);
                }}
              >
                Adjust all days
              </Button>
            </div>
          </Modal>
        );
      })()}

      {/* Settings modal */}
      {settingsOpen && (
        <SettingsModal
          initialValues={{ typicalDayStart, typicalDayEnd, loopWeekStart }}
          onSave={handleSettingsSave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
