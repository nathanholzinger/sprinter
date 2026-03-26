import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { minsToTimeStr } from '../lib/calendarUtils';

/**
 * Handles drag-to-move for existing event cards on the calendar grid.
 *
 * Returns { draggingKey, dragMovePreview, handleCardMouseDown }
 *   - draggingKey:     "${eventId}-${splitPart}" of the card being dragged, or null
 *   - dragMovePreview: null | { event, colIdx, startLoopRelMins, endLoopRelMins }
 *   - handleCardMouseDown(e, card, colIdx): attach to each card wrapper's onMouseDown
 *
 * Rules:
 *   - Multi-day recurring events are x-axis locked (time changes, days stay the same).
 *   - Span events are not draggable (multi-column semantics are too complex).
 *   - Split segments (splitPart !== 0) are not draggable.
 */
export function useDragToMove({ loopDayStart, loopDays, displayStart, totalHeight, onMove }) {
  const [draggingKey, setDraggingKey]         = useState(null);
  const [dragMovePreview, setDragMovePreview] = useState(null);

  const dragRef    = useRef(null); // active drag state
  const previewRef = useRef(null); // latest preview (for onMouseUp to read)
  const moveCtx    = useRef({});

  // Always-fresh render-time values for the stable useEffect closure
  useLayoutEffect(() => {
    moveCtx.current = { loopDayStart, loopDays, displayStart, totalHeight, onMove };
  }, [loopDayStart, loopDays, displayStart, totalHeight, onMove]);

  useEffect(() => {
    const THRESHOLD = 4; // px before drag activates

    function loopRelMinsAt(clientY, colEl, c) {
      const rect = colEl.getBoundingClientRect();
      return c.displayStart * 60 + Math.max(0, Math.min(clientY - rect.top, c.totalHeight));
    }

    function onMouseMove(e) {
      if (!dragRef.current) return;
      const drag = dragRef.current;
      if (!previewRef.current && Math.abs(e.clientY - drag.startClientY) < THRESHOLD) return;

      const c = moveCtx.current;

      // Determine target column (x-axis locked for multi-day events)
      let targetColIdx = drag.sourceColIdx;
      if (!drag.lockColumn) {
        const hoveredCol = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-day-idx]');
        if (hoveredCol) targetColIdx = Number(hoveredCol.dataset.dayIdx);
      }

      // Compute new card position from cursor Y, anchored by grab offset
      const sourceColEl = document.querySelector(`[data-day-idx="${drag.sourceColIdx}"]`);
      if (!sourceColEl) return;
      const cursorLoopRel = loopRelMinsAt(e.clientY, sourceColEl, c);
      const maxStart = Math.max(0, 24 * 60 - drag.durationMins);
      const newStart = Math.min(maxStart, Math.max(0, cursorLoopRel - drag.grabOffsetMins));
      const newEnd   = newStart + drag.durationMins;

      const preview = { event: drag.card.event, colIdx: targetColIdx, startLoopRelMins: newStart, endLoopRelMins: newEnd };
      previewRef.current = preview;
      setDragMovePreview({ ...preview });
    }

    function onMouseUp() {
      if (!dragRef.current) return;
      const drag    = dragRef.current;
      const preview = previewRef.current;
      dragRef.current    = null;
      previewRef.current = null;
      setDraggingKey(null);
      setDragMovePreview(null);

      if (!preview) return; // threshold never exceeded — was a click, not a drag

      const c = moveCtx.current;
      const toRounded = (loopRelMins) => {
        const clockMins = (loopRelMins + c.loopDayStart * 60) % (24 * 60);
        return minsToTimeStr(Math.round(clockMins / 15) * 15 % (24 * 60));
      };

      c.onMove(drag.card, preview.colIdx, toRounded(preview.startLoopRelMins), toRounded(preview.endLoopRelMins));
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, []); // stable — reads live values through moveCtx ref

  function handleCardMouseDown(e, card, colIdx) {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;                  // skip edit / delete buttons
    if ((card.event.type ?? 'recurring') === 'span') return; // span events not draggable
    if (card.splitPart !== 0) return;                        // skip overnight split segments

    e.preventDefault();
    e.stopPropagation(); // prevent column's drag-to-create from activating

    // Grab offset: minutes from card.startLoopRel to the cursor position
    const c = moveCtx.current;
    const colEl = document.querySelector(`[data-day-idx="${colIdx}"]`);
    let grabOffsetMins = (card.endLoopRel - card.startLoopRel) / 2;
    if (colEl) {
      const rect = colEl.getBoundingClientRect();
      const cursorLoopRel = c.displayStart * 60 + (e.clientY - rect.top);
      grabOffsetMins = Math.max(0, Math.min(cursorLoopRel - card.startLoopRel, card.endLoopRel - card.startLoopRel));
    }

    dragRef.current = {
      card,
      sourceColIdx:  colIdx,
      grabOffsetMins,
      durationMins:  card.endLoopRel - card.startLoopRel,
      lockColumn:    (card.event.days?.length ?? 1) > 1,
      startClientY:  e.clientY,
    };
    setDraggingKey(`${card.event.id}-${card.splitPart}`);
  }

  return { draggingKey, dragMovePreview, handleCardMouseDown };
}
