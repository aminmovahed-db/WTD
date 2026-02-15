import type { Column, Task } from '../../shared/types';

interface ArchiveViewProps {
  tasks: Task[];
  onRestore: (taskId: string, column: Column) => Promise<void>;
}

export function ArchiveView({ tasks, onRestore }: ArchiveViewProps): JSX.Element {
  if (tasks.length === 0) {
    return <p className="empty-state">No archived tasks yet.</p>;
  }

  return (
    <div className="archive-grid">
      {tasks.map((task) => (
        <article className="archive-card" key={task.id}>
          <h4>{task.title}</h4>
          {task.notes ? <p>{task.notes}</p> : null}
          <div className="archive-actions">
            <button onClick={() => onRestore(task.id, 'BACKLOG')} type="button">
              Restore to Backlog
            </button>
            <button onClick={() => onRestore(task.id, 'DONE')} type="button">
              Restore to Done
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
