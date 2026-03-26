export default function EventCard({ event, segmentStart, segmentEnd, clippedTop, clippedBottom, leftCount, rightCount, onEdit, onDelete, dragging, resizable }) {
  const displayStart = segmentStart ?? event.startTime;
  const displayEnd = segmentEnd ?? event.endTime;
  const isSegment = segmentStart !== undefined || segmentEnd !== undefined;
  const fullTime = `${event.startTime} – ${event.endTime}`;
  const segmentTime = `${displayStart} – ${displayEnd}`;

  const hasTopBanner    = clippedTop || leftCount > 0;
  const hasBottomBanner = clippedBottom || rightCount > 0;

  return (
    <div
      data-event-card
      className={`group relative flex h-full flex-col overflow-hidden rounded-lg border border-blue-200 bg-blue-50 text-left shadow-sm hover:border-blue-400 hover:shadow transition-all ${dragging ? 'opacity-40' : ''}`}
      title={isSegment ? `${fullTime} (full event)` : fullTime}
    >
      {/* Top banner: ← +N (prev days) and/or ↑ (clipped above) */}
      {hasTopBanner && (
        <div className="flex items-center justify-between shrink-0 px-1.5 py-0.5 bg-blue-200/80 text-blue-800 leading-none">
          {leftCount > 0 ? (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold">
              <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
              </svg>
              +{leftCount}
            </span>
          ) : <span />}
          {clippedTop && (
            <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col px-2 py-1 overflow-hidden min-h-0">
        <span className="truncate text-xs font-semibold text-blue-900 leading-snug pr-8">
          {event.title || <span className="italic text-blue-400">Untitled</span>}
        </span>
        <span className="truncate text-xs text-blue-600">
          {segmentTime}
        </span>
      </div>

      {/* Bottom banner: ↓ (clipped below) and/or +N → (next days) */}
      {hasBottomBanner && (
        <div className="flex items-center justify-between shrink-0 px-1.5 py-0.5 bg-blue-200/80 text-blue-800 leading-none">
          {clippedBottom ? (
            <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
            </svg>
          ) : <span />}
          {rightCount > 0 ? (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold">
              +{rightCount}
              <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </span>
          ) : <span />}
        </div>
      )}

      {/* Resize handles — visible on hover, only for resizable (non-span, non-split) cards */}
      {resizable && (
        <>
          <div data-resize-handle="top"    className="absolute top-0    left-0 right-0 h-1.5 cursor-ns-resize rounded-t-lg z-10 group-hover:bg-blue-400/40 transition-colors" />
          <div data-resize-handle="bottom" className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize rounded-b-lg z-10 group-hover:bg-blue-400/40 transition-colors" />
        </>
      )}

      {/* Edit / delete buttons */}
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(event); }}
          className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700 transition-colors"
          aria-label="Edit event"
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
          className="rounded p-0.5 text-blue-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label="Delete event"
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
