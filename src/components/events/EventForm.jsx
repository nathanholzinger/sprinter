import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { createEvent, createSpanEvent } from '../../store/useTemplateStore';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export default function EventForm({ initialEvent, defaultDay, defaultStartTime, defaultEndTime, defaultType, defaultSpanStartDay, defaultSpanEndDay, loopDays, onSave, onClose }) {
  const initialType = initialEvent?.type ?? defaultType ?? 'recurring';
  const [eventType, setEventType] = useState(initialType);

  const [form, setForm] = useState(() => {
    if (initialEvent) return { ...initialEvent };
    if (initialType === 'span') {
      return createSpanEvent({
        startDay: defaultSpanStartDay ?? loopDays[0].dayName,
        endDay:   defaultSpanEndDay   ?? defaultSpanStartDay ?? loopDays[0].dayName,
        ...(defaultStartTime && { startTime: defaultStartTime }),
        ...(defaultEndTime   && { endTime:   defaultEndTime   }),
      });
    }
    return createEvent({
      days: [defaultDay ?? loopDays[0].dayName],
      ...(defaultStartTime && { startTime: defaultStartTime }),
      ...(defaultEndTime   && { endTime:   defaultEndTime   }),
    });
  });

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleTypeToggle(newType) {
    if (newType === eventType) return;
    setEventType(newType);
    setForm((prev) =>
      newType === 'span'
        ? createSpanEvent({ title: prev.title, notes: prev.notes, startDay: defaultDay ?? loopDays[0].dayName })
        : createEvent({ title: prev.title, notes: prev.notes, days: [defaultDay ?? loopDays[0].dayName] })
    );
  }

  function toggleDay(day) {
    setForm((prev) => {
      const already = prev.days.includes(day);
      if (already && prev.days.length === 1) return prev;
      return {
        ...prev,
        days: already ? prev.days.filter((d) => d !== day) : [...prev.days, day],
      };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  // Recurring-only
  const isOvernight = eventType === 'recurring' && form.startTime && form.endTime && form.endTime <= form.startTime;

  // Span validation
  const spanStartIdx = eventType === 'span' ? loopDays.findIndex((d) => d.dayName === form.startDay) : 0;
  const spanEndIdx   = eventType === 'span' ? loopDays.findIndex((d) => d.dayName === form.endDay)   : 0;
  const spanDayError = eventType === 'span' && spanEndIdx < spanStartIdx
    ? 'End day must be the same as or after start day.'
    : null;

  const isValid =
    form.title.trim() &&
    form.startTime &&
    form.endTime &&
    (eventType === 'recurring' ? form.days.length > 0 : !spanDayError);

  return (
    <Modal title={initialEvent ? 'Edit event' : 'New event'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            autoFocus
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Morning standup"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Type toggle — hidden in edit mode */}
        {!initialEvent && (
          <div className="flex rounded-lg border border-gray-200 p-0.5 self-start gap-0.5">
            {['recurring', 'span'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeToggle(t)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  eventType === t
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}

        {eventType === 'recurring' ? (
          <>
            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {isOvernight && (
              <p className="text-xs text-purple-600 -mt-2">This event runs overnight into the next day.</p>
            )}

            {/* Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Days</label>
              <div className="flex gap-1.5">
                {DAYS.map((day) => {
                  const checked = form.days?.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Span fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start day</label>
                <select
                  value={form.startDay}
                  onChange={(e) => set('startDay', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {loopDays.map((d) => (
                    <option key={d.dayName} value={d.dayName}>{DAY_LABELS[d.dayName]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End day</label>
                <select
                  value={form.endDay}
                  onChange={(e) => set('endDay', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {loopDays.map((d) => (
                    <option key={d.dayName} value={d.dayName}>{DAY_LABELS[d.dayName]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {spanDayError && (
              <p className="text-xs text-red-500 -mt-2">{spanDayError}</p>
            )}
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Any details..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!isValid}>
            {initialEvent ? 'Save changes' : 'Add event'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
