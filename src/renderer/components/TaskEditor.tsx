import { useEffect, useState, type FormEvent } from 'react';
import { PRIORITIES, type Priority, type Task } from '../../shared/types';

interface TaskEditorProps {
  task: Task | null;
  onClose: () => void;
  onSave: (taskId: string, updates: { title?: string; notes?: string; priority?: Priority }) => Promise<void>;
}

export function TaskEditor({ task, onClose, onSave }: TaskEditorProps): JSX.Element | null {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('LOW');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) {
      return;
    }

    setTitle(task.title);
    setNotes(task.notes);
    setPriority(task.priority);
    setError(null);
  }, [task]);

  if (!task) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required.');
      return;
    }

    setSaving(true);
    try {
      await onSave(task.id, { title: trimmed, notes, priority });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <header>
          <h3>Edit Task</h3>
        </header>
        <form onSubmit={handleSubmit} className="task-editor-form">
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={8} />
          </label>
          <label>
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item[0] + item.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <div className="editor-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
