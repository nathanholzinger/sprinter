import { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import TemplateCard from './TemplateCard';
import { useTemplateStore, createTemplate } from '../../store/useTemplateStore';

export default function TemplateList({ onEditTemplate }) {
  const { state, dispatch } = useTemplateStore();
  const [creating, setCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');

  function handleCreate(e) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    dispatch({ type: 'ADD_TEMPLATE', template: createTemplate(trimmed) });
    setNameInput('');
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sprinter</h1>
            <p className="text-sm text-gray-500 mt-1">Weekly schedule templates</p>
          </div>
          <Button onClick={() => { setNameInput(''); setCreating(true); }}>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            New template
          </Button>
        </div>

        {state.templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center">
            <svg className="h-10 w-10 text-gray-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <p className="text-sm font-medium text-gray-500">No templates yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first weekly schedule template to get started.</p>
            <Button className="mt-5" onClick={() => { setNameInput(''); setCreating(true); }}>
              Create template
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {state.templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={onEditTemplate}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <Modal title="New template" onClose={() => setCreating(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template name
              </label>
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder='e.g. "A Week" or "Normal week"'
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={!nameInput.trim()}>Create</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
