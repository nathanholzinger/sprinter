import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { minsToTimeStr } from '../lib/calendarUtils';

const MIN_DURATION_MINS = 15;

/**
 * Handles drag-to-resize for existing event cards (top edge = start, bottom edge = end).
 *
 * Returns { resizingKey, resizePreview, handleResizeMouseDown }
 *   - resizingKey:     "${eventId}-${splitPart}" of the card being resized, or null
 *   - resizePreview:   null | { event, colIdx, startLoopRelMins, endLoopRelMins }
 *   - handleResizeMouseDown(e, card, colIdx, edge): edge is 'top' | 'bottom'
 *
 * Rules:
 *   - Span events are not resizable.
 *   - Split segments (splitPart !== 0) are not resizable.
 *   - Snaps to 15-minute increments in real time.
 */
export function useDragToResize({ loopDayStart, loopDays, displayStart, totalHeight, onResize }) {
  const [resizingKey, setResizingKey]       = useState(null);
  const [resizePreview, setResizePreview]   = useState(null);

  const dragRef    = useRef(null); // { card, colIdx, edge, fixed }
  const previewRef = useRef(null);
  const resizeCtx  = useRef({});

  // Always-fresh render-time values for the stable useEffect closure
  useLayoutEffect(() => {
    resizeCtx.current = { loopDayStart, loopDays, displayStart, totalHeight, onResize };
  }, [loopDayStart, loopDays, displayStart, totalHeight, onResize]);

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragRef.current) return;
      const drag = dragRef.current;
      const c    = resizeCtx.current;

      const colEl = document.querySelector(`[data-day-idx="${drag.colIdx}"]`);
      if (!colEl) return;
      const rect          = colEl.getBoundingClientRect();
      const cursorLoopRel = c.displayStart * 60 + (e.clientY - rect.top);
      const snapped       = Math.round(cursorLoopRel / 15) * 15;

      let newStart, newEnd;
      if (drag.edge === 'top') {
        newStart = Math.max(0, Math.min(snapped, drag.fixed - MIN_DURATION_MINS));
        newEnd   = drag.fixed;
      } else {
        newStart = drag.fixed;
        newEnd   = Math.min(24 * 60, Math.max(snapped, drag.fixed + MIN_DURATION_MINS));
      }

      const preview = { event: drag.card.event, colIdx: drag.colIdx, startLoopRelMins: newStart, endLoopRelMins: newEnd };
      previewRef.current = preview;
      setResizePreview({ ...preview });
    }

    function onMouseUp() {
      if (!dragRef.current) return;
      const drag    = dragRef.current;
      const preview = previewRef.current;
      dragRef.current    = null;
      previewRef.current = null;
      setResizingKey(null);
      setResizePreview(null);

      if (!preview) return;

      const c = resizeCtx.current;
      const toClockStr = (loopRelMins) => {
        const clockMins = (loopRelMins + c.loopDayStart * 60) % (24 * 60);
        return minsToTimeStr(Math.round(clockMins / 15) * 15 % (24 * 60));
      };

      c.onResize(drag.card, toClockStr(preview.startLoopRelMins), toClockStr(preview.endLoopRelMins));
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, []); // stable — reads live values through resizeCtx ref

  function handleResizeMouseDown(e, card, colIdx, edge) {
    if (e.button !== 0) return;
    if ((card.event.type ?? 'recurring') === 'span') return; // span events not resizable
    if (card.splitPart !== 0) return;                        // skip overnight split segments

    e.preventDefault();
    e.stopPropagation(); // prevent drag-to-move and drag-to-create from activating

    dragRef.current = {
      card,
      colIdx,
      edge,
      fixed: edge === 'top' ? card.endLoopRel : card.startLoopRel,
    };
    setResizingKey(`${card.event.id}-${card.splitPart}`);
  }

  return { resizingKey, resizePreview, handleResizeMouseDown };
}
