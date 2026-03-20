import { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { useTemplateStore } from '../../store/useTemplateStore';

export default function TemplateCard({ template, onEdit }) {
  const { dispatch } = useTemplateStore();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameInput, setNameInput] = useState(template.name);

  const eventCount = template.events.length;

  function handleRename(e) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== template.name) {
      dispatch({ type: 'RENAME_TEMPLATE', id: template.id, name: trimmed });
    }
    setRenaming(false);
  }

  function handleDelete() {
    dispatch({ type: 'DELETE_TEMPLATE', id: template.id });
    setConfirmDelete(false);
  }

  return (
    <>
      <div className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 leading-tight">{template.name}</h3>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => { setNameInput(template.name); setRenaming(true); }}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Rename template"
              title="Rename"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
              </svg>
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              aria-label="Delete template"
              title="Delete"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          {eventCount === 0 ? 'No events yet' : `${eventCount} event${eventCount !== 1 ? 's' : ''}`}
        </p>

        <Button onClick={() => onEdit(template.id)} variant="secondary" size="sm" className="self-start">
          Open editor
        </Button>
      </div>

      {renaming && (
        <Modal title="Rename template" onClose={() => setRenaming(false)}>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Template name"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRenaming(false)}>Cancel</Button>
              <Button type="submit" disabled={!nameInput.trim()}>Save</Button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete template" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete <strong>{template.name}</strong>? This will remove all its events and cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
