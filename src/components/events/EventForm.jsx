import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { createEvent } from '../../store/useTemplateStore';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export default function EventForm({ initialEvent, defaultDay, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (initialEvent) return { ...initialEvent };
    return createEvent({ days: [defaultDay ?? 'monday'] });
  });

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleDay(day) {
    setForm((prev) => {
      const already = prev.days.includes(day);
      if (already && prev.days.length === 1) return prev; // must keep at least one
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

  const isValid = form.title.trim() && form.startTime && form.endTime && form.days.length > 0;
  const isOvernight = form.startTime && form.endTime && form.endTime <= form.startTime;

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
              const checked = form.days.includes(day);
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
