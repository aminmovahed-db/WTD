import type { Task } from '../../shared/types';

interface TaskCardPreviewProps {
  task: Task;
}

export function TaskCardPreview({ task }: TaskCardPreviewProps): JSX.Element {
  return (
    <article className="task-card drag-overlay-card" aria-hidden="true">
      <div className="task-main">
        <h4>{task.title}</h4>
        {task.notes ? <p>{task.notes}</p> : null}
      </div>
      {task.column === 'DONE' ? <div className="task-archive">Archive</div> : null}
    </article>
  );
}
