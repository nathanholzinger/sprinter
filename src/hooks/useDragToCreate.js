import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { minsToTimeStr } from '../lib/calendarUtils';

/**
 * Encapsulates all drag-to-create interaction logic for the calendar grid.
 *
 * Returns { dragPreview, handleColumnMouseDown }.
 *   - dragPreview: null | { startDayIdx, startLoopRelMins, endDayIdx, endLoopRelMins }
 *   - handleColumnMouseDown(e, colIdx): attach to onMouseDown of each day column
 */
export function useDragToCreate({ loopDayStart, loopDays, displayStart, totalHeight, setFormState }) {
  const dragAnchorRef  = useRef(null); // { loopDayIdx, loopRelMins, startClientX, startClientY }
  const dragPreviewRef = useRef(null); // normalised { startDayIdx, startLoopRelMins, endDayIdx, endLoopRelMins }
  const [dragPreview, setDragPreview] = useState(null);

  // Always-fresh render-time values for the stable useEffect closure
  const dragCtx = useRef({});

  useLayoutEffect(() => {
    dragCtx.current = { loopDayStart, loopDays, displayStart, totalHeight, setFormState };
  }, [loopDayStart, loopDays, displayStart, totalHeight, setFormState]);

  useEffect(() => {
    const THRESHOLD = 8; // px before drag activates

    function colRelMins(clientY, colEl, ctx) {
      const rect = colEl.getBoundingClientRect();
      return ctx.displayStart * 60 + Math.max(0, Math.min(clientY - rect.top, ctx.totalHeight));
    }

    function onMouseMove(e) {
      if (!dragAnchorRef.current) return;
      const anchor = dragAnchorRef.current;
      const dy = e.clientY - anchor.startClientY;
      const dx = e.clientX - anchor.startClientX;
      if (!dragPreviewRef.current && Math.abs(dy) < THRESHOLD && Math.abs(dx) < 10) return;

      const ctx = dragCtx.current;
      const colEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-day-idx]');
      if (!colEl) return;

      const endDayIdx     = Number(colEl.dataset.dayIdx);
      const endRelMins    = colRelMins(e.clientY, colEl, ctx);
      const anchorColEl   = document.querySelector(`[data-day-idx="${anchor.loopDayIdx}"]`);
      const startRelMins  = anchorColEl ? colRelMins(anchor.startClientY, anchorColEl, ctx) : anchor.loopRelMins;

      // Normalise: start ≤ end (by day index, then by time)
      let [sDayIdx, sRel, eDayIdx, eRel] = [anchor.loopDayIdx, startRelMins, endDayIdx, endRelMins];
      if (eDayIdx < sDayIdx || (eDayIdx === sDayIdx && eRel < sRel)) {
        [sDayIdx, eDayIdx] = [eDayIdx, sDayIdx];
        [sRel,    eRel]    = [eRel,    sRel];
      }

      const preview = { startDayIdx: sDayIdx, startLoopRelMins: sRel, endDayIdx: eDayIdx, endLoopRelMins: eRel };
      dragPreviewRef.current = preview;
      setDragPreview({ ...preview });
    }

    function onMouseUp(e) {
      if (!dragAnchorRef.current) return;
      const anchor  = dragAnchorRef.current;
      const preview = dragPreviewRef.current;
      dragAnchorRef.current  = null;
      dragPreviewRef.current = null;
      setDragPreview(null);

      const ctx = dragCtx.current;

      if (!preview) {
        // Plain click — use anchor position
        if (e.target.closest('[data-event-card]')) return;
        const clockMins = (anchor.loopRelMins + ctx.loopDayStart * 60) % (24 * 60);
        const rounded   = Math.round(clockMins / 15) * 15 % (24 * 60);
        ctx.setFormState({
          defaultDay: ctx.loopDays[anchor.loopDayIdx].dayName,
          startTime:  minsToTimeStr(rounded),
          endTime:    minsToTimeStr((rounded + 60) % (24 * 60)),
        });
        return;
      }

      const toRounded = (loopRelMins) => {
        const clockMins = (loopRelMins + ctx.loopDayStart * 60) % (24 * 60);
        return minsToTimeStr(Math.round(clockMins / 15) * 15 % (24 * 60));
      };
      const startTime = toRounded(preview.startLoopRelMins);
      const endTime   = toRounded(preview.endLoopRelMins);

      if (preview.startDayIdx === preview.endDayIdx) {
        ctx.setFormState({
          defaultDay: ctx.loopDays[preview.startDayIdx].dayName,
          startTime,
          endTime,
        });
      } else {
        ctx.setFormState({
          defaultType:         'span',
          defaultSpanStartDay: ctx.loopDays[preview.startDayIdx].dayName,
          defaultSpanEndDay:   ctx.loopDays[preview.endDayIdx].dayName,
          startTime,
          endTime,
        });
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, []); // stable — reads live values through dragCtx ref

  function handleColumnMouseDown(e, colIdx) {
    if (e.button !== 0) return;
    if (e.target.closest('[data-event-card]')) return;
    e.preventDefault(); // prevent text selection during drag
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = Math.max(0, Math.min(e.clientY - rect.top, totalHeight));
    dragAnchorRef.current = {
      loopDayIdx:   colIdx,
      loopRelMins:  displayStart * 60 + relY,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
  }

  return { dragPreview, handleColumnMouseDown };
}
