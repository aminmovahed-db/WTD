import { useCallback, useState } from 'react';
import type { Column, Task } from '../../shared/types';
import { LinkifiedText } from './LinkifiedText';
import { PriorityTag } from './PriorityTag';
import { tagColorStyle } from '../utils/tagColors';

interface ArchiveViewProps {
  tasks: Task[];
  onRestore: (taskId: string, column: Column) => Promise<void>;
  onDelete: (taskIds: string[]) => Promise<void>;
}

export function ArchiveView({ tasks, onRestore, onDelete }: ArchiveViewProps): JSX.Element {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function exitSelectMode(): void {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function handleDelete(): Promise<void> {
    if (selected.size === 0) return;
    const count = selected.size;
    const confirmed = window.confirm(`Permanently delete ${count} archived task${count > 1 ? 's' : ''}?`);
    if (!confirmed) return;
    await onDelete(Array.from(selected));
    exitSelectMode();
  }

  async function handleRestore(column: Column): Promise<void> {
    if (selected.size === 0) return;
    for (const id of selected) {
      await onRestore(id, column);
    }
    exitSelectMode();
  }

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setViewingTask(null);
    }
  }, []);

  if (tasks.length === 0) {
    return <p className="empty-state">No archived tasks yet.</p>;
  }

  return (
    <div className="archive-container">
      <div className="archive-toolbar">
        <button
          type="button"
          className={`archive-select-btn${selectMode ? ' archive-select-btn--active' : ''}`}
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
        {selectMode && selected.size > 0 ? (
          <>
            <button type="button" className="archive-restore-btn" onClick={() => handleRestore('BACKLOG')}>
              Restore to Backlog
            </button>
            <button type="button" className="archive-restore-btn" onClick={() => handleRestore('DONE')}>
              Restore to Done
            </button>
            <button type="button" className="archive-delete-btn" onClick={handleDelete}>
              Delete {selected.size} task{selected.size > 1 ? 's' : ''}
            </button>
          </>
        ) : null}
      </div>
      <div className="archive-grid">
        {tasks.map((task) => (
          <article
            className={`archive-card${selectMode && selected.has(task.id) ? ' archive-card--selected' : ''}`}
            key={task.id}
            onClick={selectMode ? () => toggleSelect(task.id) : () => setViewingTask(task)}
          >
            {selectMode ? (
              <label className="archive-checkbox" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(task.id)}
                  onChange={() => toggleSelect(task.id)}
                />
              </label>
            ) : null}
            <h4 title={task.title}>{task.title}</h4>
            {task.tag ? (
              <span className="task-tag" style={tagColorStyle(task.tag)}>{task.tag}</span>
            ) : null}
          </article>
        ))}
      </div>

      {viewingTask ? (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
          <div className="modal-card archive-detail-modal">
            <header>
              <h3>{viewingTask.title}</h3>
            </header>
            <div className="archive-detail-body">
              {viewingTask.priority !== 'NONE' ? (
                <div className="archive-detail-row">
                  <span className="archive-detail-label">Priority</span>
                  <PriorityTag priority={viewingTask.priority} />
                </div>
              ) : null}
              {viewingTask.tag ? (
                <div className="archive-detail-row">
                  <span className="archive-detail-label">Tag</span>
                  <span className="task-tag" style={tagColorStyle(viewingTask.tag)}>{viewingTask.tag}</span>
                </div>
              ) : null}
              {viewingTask.effort > 0 ? (
                <div className="archive-detail-row">
                  <span className="archive-detail-label">Effort</span>
                  <span className="archive-detail-value">{viewingTask.effort}</span>
                </div>
              ) : null}
              {viewingTask.notes ? (
                <div className="archive-detail-notes">
                  <span className="archive-detail-label">Notes</span>
                  <div className="archive-detail-notes-content">
                    <LinkifiedText text={viewingTask.notes} />
                  </div>
                </div>
              ) : null}
              {viewingTask.archived_at ? (
                <div className="archive-detail-row">
                  <span className="archive-detail-label">Archived</span>
                  <span className="archive-detail-value">{new Date(viewingTask.archived_at).toLocaleDateString()}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
