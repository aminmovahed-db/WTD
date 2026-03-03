import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { EFFORTS, PRIORITIES, type Effort, type Priority, type Task } from '../../shared/types';
import { LinkifiedText } from './LinkifiedText';

const URL_PRESENT = /https?:\/\//;

interface TaskEditorProps {
  task: Task | null;
  onClose: () => void;
  onSave: (taskId: string, updates: { title?: string; notes?: string; tag?: string; effort?: Effort; priority?: Priority }) => Promise<void>;
}

export function TaskEditor({ task, onClose, onSave }: TaskEditorProps): JSX.Element | null {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tag, setTag] = useState('');
  const [effort, setEffort] = useState<Effort>(0);
  const [priority, setPriority] = useState<Priority>('NONE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleNotesKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== ' ') return;

    const ta = e.currentTarget;
    const { selectionStart, value } = ta;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const textBeforeCursor = value.slice(lineStart, selectionStart);

    if (textBeforeCursor !== '*') return;

    e.preventDefault();
    const before = value.slice(0, lineStart);
    const after = value.slice(selectionStart);
    const updated = `${before}• ${after}`;
    setNotes(updated);

    requestAnimationFrame(() => {
      const cursor = lineStart + 2;
      ta.selectionStart = cursor;
      ta.selectionEnd = cursor;
    });
  }, []);

  const showNotesPreview = !editingNotes && notes.length > 0 && URL_PRESENT.test(notes);

  const handleNotesPreviewClick = useCallback(() => {
    setEditingNotes(true);
    requestAnimationFrame(() => notesRef.current?.focus());
  }, []);

  const handleNotesBlur = useCallback(() => {
    setEditingNotes(false);
  }, []);

  useEffect(() => {
    if (!task) {
      return;
    }

    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Enter' && e.metaKey) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [task]);

  useEffect(() => {
    if (!task) {
      return;
    }

    setTitle(task.title);
    setNotes(task.notes);
    setTag(task.tag);
    setEffort(task.effort);
    setPriority(task.priority);
    setError(null);
    setEditingNotes(false);
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
      await onSave(task.id, { title: trimmed, notes, tag: tag.trim(), effort, priority });
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
        <form ref={formRef} onSubmit={handleSubmit} className="task-editor-form">
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
          </label>
          <label>
            Notes
            {showNotesPreview ? (
              <div className="notes-preview" onClick={handleNotesPreviewClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') handleNotesPreviewClick(); }}>
                <LinkifiedText text={notes} />
              </div>
            ) : (
              <textarea ref={notesRef} value={notes} onChange={(event) => setNotes(event.target.value)} onKeyDown={handleNotesKeyDown} onBlur={handleNotesBlur} maxLength={5000} rows={8} />
            )}
          </label>
          <label>
            Tag
            <input value={tag} onChange={(event) => setTag(event.target.value)} maxLength={50} placeholder="e.g. bug, feature, urgent" />
          </label>
          <label>
            Effort
            <select value={effort} onChange={(event) => setEffort(Number(event.target.value) as Effort)}>
              {EFFORTS.map((val) => (
                <option key={val} value={val}>
                  {val === 0 ? 'None' : val}
                </option>
              ))}
            </select>
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
