import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { DAYS, formatClockHour } from '../../lib/calendarUtils';

export default function SettingsModal({ initialValues, onSave, onClose }) {
  const [form, setForm] = useState(initialValues);

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  return (
    <Modal title="Calendar settings" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day start</label>
            <select
              value={form.typicalDayStart}
              onChange={(e) => set('typicalDayStart', Number(e.target.value))}
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
              value={form.typicalDayEnd}
              onChange={(e) => set('typicalDayEnd', Number(e.target.value))}
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
            value={form.loopWeekStart}
            onChange={(e) => set('loopWeekStart', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-400 -mt-2">
          The calendar defaults to {formatClockHour(form.typicalDayStart)} – {formatClockHour(form.typicalDayEnd)}.
          Use expand buttons to reveal hours outside this range.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
